import cron from 'node-cron';
import zkService from './zkService.js';
import edaraService from './edaraService.js';
import { deviceConfig } from '../config/deviceConfig.js';

class SchedulerService {
  constructor() {
    this.jobs = [];
    this.lastSync = null;
    this.lastStatus = 'Idle';
    this.lastCount = 0;
    this.lastSummary = null;
  }

  /**
   * Run automated sync job from MB2000 to all defined Edara HR destination servers
   */
  async runAutoSync(triggerSource = 'Scheduled Job') {
    const timestamp = new Date().toLocaleString();
    console.log(`\n⏰ [CRON] ${triggerSource} triggered at ${timestamp}`);

    try {
      this.lastStatus = `Syncing (${triggerSource})...`;
      
      // 1. Fetch latest attendance punches from ZKTeco MB2000
      const logs = await zkService.getAttendances();
      const records = Array.isArray(logs) ? logs : [];

      if (records.length === 0) {
        console.log(`ℹ️ [CRON] No attendance records found on MB2000.`);
        this.lastStatus = `Completed: 0 records found`;
        this.lastSync = new Date().toISOString();
        return { success: true, count: 0 };
      }

      // 2. Format to Edara HR schema
      const edaraFormatted = edaraService.formatRecords(records);

      // 3. Dispatch to all active configured Edara Cloud HR API servers
      const summary = await edaraService.syncAttendanceRecordsToServers(edaraFormatted, { serverId: 'all', autoSyncOnly: true });

      this.lastSync = new Date().toISOString();
      this.lastCount = edaraFormatted.length;
      this.lastSummary = summary;

      if (summary.failCount === 0) {
        this.lastStatus = `Success: Synced ${edaraFormatted.length} records to all ${summary.totalServers} servers`;
        console.log(`✅ [CRON] Auto-sync SUCCESS! Sent ${edaraFormatted.length} punches to ${summary.totalServers} servers.`);
      } else {
        this.lastStatus = `Partial: Synced to ${summary.successCount}/${summary.totalServers} servers (${summary.failCount} failed)`;
        console.warn(`⚠️ [CRON] Auto-sync PARTIAL: ${summary.successCount}/${summary.totalServers} succeeded.`);
      }

      summary.serverResults.forEach((res) => {
        if (res.success) {
          console.log(`   - [${res.serverName}]: ✅ SUCCESS (${res.status})`);
        } else {
          console.log(`   - [${res.serverName}]: ❌ FAILED (${res.error})`);
        }
      });

      return {
        success: summary.successCount > 0,
        count: edaraFormatted.length,
        summary
      };
    } catch (error) {
      this.lastStatus = `Failed: ${error.message || 'Error'}`;
      console.error(`❌ [CRON] Auto-sync FAILED:`, error.message || error);
      return {
        success: false,
        error: error.message || error
      };
    }
  }

  /**
   * Initialize daily scheduled cron tasks
   * Schedules:
   * 1. 11:00 AM every day ('0 11 * * *')
   * 2. 08:00 PM every day ('0 20 * * *')
   */
  initScheduler() {
    console.log('⏳ Initializing Edara HR Auto-Sync Scheduler...');

    // 11:00 AM Cron
    const job11AM = cron.schedule('0 11 * * *', () => {
      this.runAutoSync('Daily 11:00 AM Schedule');
    }, deviceConfig.timezone ? { timezone: deviceConfig.timezone } : {});

    // 08:00 PM Cron (20:00)
    const job08PM = cron.schedule('0 20 * * *', () => {
      this.runAutoSync('Daily 08:00 PM Schedule');
    }, deviceConfig.timezone ? { timezone: deviceConfig.timezone } : {});

    this.jobs.push({ name: '11:00 AM Job', expression: '0 11 * * *', job: job11AM });
    this.jobs.push({ name: '08:00 PM Job', expression: '0 20 * * *', job: job08PM });

    console.log('✅ Scheduler active:');
    console.log('   - 🕒 Job 1: Every day at 11:00 AM (0 11 * * *)');
    console.log('   - 🕒 Job 2: Every day at 08:00 PM (0 20 * * *)');
  }

  getSchedulerStatus() {
    return {
      activeSchedules: [
        { time: '11:00 AM Daily', cron: '0 11 * * *' },
        { time: '08:00 PM Daily', cron: '0 20 * * *' }
      ],
      timezone: deviceConfig.timezone || 'server local time',
      lastSync: this.lastSync,
      lastStatus: this.lastStatus,
      lastCount: this.lastCount,
      lastSummary: this.lastSummary
    };
  }
}

export const schedulerService = new SchedulerService();
export default schedulerService;
