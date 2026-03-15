import { createLogger } from '../logger'
import { getSetting, saveSetting } from '../database'

const logger = createLogger('i18n-config')

// ============================================================
// Multi-Language i18n Configuration for ByteFix
// 7 languages: English, Hindi, Tamil, Telugu, Bengali, Marathi, Kannada
// Technical terms stay in English (RAM, SSD, BIOS, driver, Windows, CPU, GPU)
// ============================================================

export type SupportedLanguage = 'en' | 'hi' | 'ta' | 'te' | 'bn' | 'mr' | 'kn'

export interface LanguageInfo {
  code: SupportedLanguage
  name: string
  nativeName: string
  direction: 'ltr' | 'rtl'
}

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English', direction: 'ltr' },
  { code: 'hi', name: 'Hindi', nativeName: '\u0939\u093F\u0928\u094D\u0926\u0940', direction: 'ltr' },
  { code: 'ta', name: 'Tamil', nativeName: '\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD', direction: 'ltr' },
  { code: 'te', name: 'Telugu', nativeName: '\u0C24\u0C46\u0C32\u0C41\u0C17\u0C41', direction: 'ltr' },
  { code: 'bn', name: 'Bengali', nativeName: '\u09AC\u09BE\u0982\u09B2\u09BE', direction: 'ltr' },
  { code: 'mr', name: 'Marathi', nativeName: '\u092E\u0930\u093E\u0920\u0940', direction: 'ltr' },
  { code: 'kn', name: 'Kannada', nativeName: '\u0C95\u0CA8\u0CCD\u0CA8\u0CA1', direction: 'ltr' }
]

// ============================================================
// Translation Dictionaries
// Only translate: actions, status, descriptions, customer-facing text
// Technical terms (RAM, SSD, BIOS, driver, Windows, CPU, GPU) stay English
// ============================================================

type TranslationDictionary = Record<string, string>

const translations: Record<SupportedLanguage, TranslationDictionary> = {
  en: {
    // Navigation & Common
    'app.name': 'ByteFix',
    'app.tagline': 'Professional Computer Repair & Diagnostics',
    'nav.dashboard': 'Dashboard',
    'nav.diagnostics': 'Diagnostics',
    'nav.performance': 'Performance',
    'nav.malware': 'Malware Scan',
    'nav.network': 'Network',
    'nav.osRepair': 'OS Repair',
    'nav.battery': 'Battery',
    'nav.diskHealth': 'Disk Health',
    'nav.dataRecovery': 'Data Recovery',
    'nav.passwordRecovery': 'Password Recovery',
    'nav.billing': 'GST Billing',
    'nav.customers': 'Customers',
    'nav.repairJobs': 'Repair Jobs',
    'nav.backup': 'Backup Wizard',
    'nav.settings': 'Settings',
    'nav.reports': 'Reports',

    // Actions
    'action.scan': 'Start Scan',
    'action.fix': 'Auto Fix',
    'action.fixAll': 'Fix All Issues',
    'action.cancel': 'Cancel',
    'action.save': 'Save',
    'action.delete': 'Delete',
    'action.edit': 'Edit',
    'action.close': 'Close',
    'action.back': 'Back',
    'action.next': 'Next',
    'action.create': 'Create',
    'action.update': 'Update',
    'action.search': 'Search',
    'action.export': 'Export',
    'action.print': 'Print',
    'action.download': 'Download',
    'action.refresh': 'Refresh',
    'action.retry': 'Retry',

    // Status
    'status.scanning': 'Scanning...',
    'status.fixing': 'Fixing...',
    'status.complete': 'Complete',
    'status.failed': 'Failed',
    'status.healthy': 'Healthy',
    'status.warning': 'Warning',
    'status.critical': 'Critical',
    'status.pending': 'Pending',
    'status.inProgress': 'In Progress',
    'status.ready': 'Ready',

    // Job Status
    'job.received': 'Device Received',
    'job.diagnosing': 'Diagnosing',
    'job.waitingParts': 'Waiting for Parts',
    'job.repairInProgress': 'Repair In Progress',
    'job.ready': 'Ready for Pickup',
    'job.delivered': 'Delivered',
    'job.cancelled': 'Cancelled',

    // Billing
    'billing.invoice': 'Invoice',
    'billing.createInvoice': 'Create Invoice',
    'billing.invoiceNumber': 'Invoice Number',
    'billing.subtotal': 'Subtotal',
    'billing.cgst': 'CGST',
    'billing.sgst': 'SGST',
    'billing.igst': 'IGST',
    'billing.total': 'Total',
    'billing.paid': 'Paid',
    'billing.unpaid': 'Unpaid',
    'billing.payViaUPI': 'Pay via UPI',
    'billing.generateQR': 'Generate QR Code',

    // Customer
    'customer.name': 'Customer Name',
    'customer.phone': 'Phone Number',
    'customer.email': 'Email',
    'customer.address': 'Address',
    'customer.gstin': 'GSTIN',
    'customer.addNew': 'Add New Customer',
    'customer.history': 'Customer History',
    'customer.totalVisits': 'Total Visits',

    // Device
    'device.brand': 'Device Brand',
    'device.model': 'Device Model',
    'device.serial': 'Serial Number',
    'device.complaint': 'Complaint / Issue',

    // Backup
    'backup.title': 'Backup Wizard',
    'backup.createBackup': 'Create Backup',
    'backup.selectTargets': 'Select files to backup',
    'backup.destination': 'Backup Destination',
    'backup.browserData': 'Browser Data',
    'backup.migrationGuide': 'Migration Guide',
    'backup.estimatedTime': 'Estimated Time',
    'backup.totalSize': 'Total Size',

    // Diagnostics descriptions
    'diag.systemHealth': 'System Health Score',
    'diag.issuesFound': 'Issues Found',
    'diag.fixesApplied': 'Fixes Applied',
    'diag.noIssues': 'No issues found! Your system is healthy.',

    // WhatsApp
    'whatsapp.sendUpdate': 'Send WhatsApp Update',
    'whatsapp.sendPaymentLink': 'Send Payment Link',
    'whatsapp.sendReport': 'Send Diagnostic Report',

    // Settings
    'settings.language': 'Language',
    'settings.shopName': 'Shop Name',
    'settings.shopGstin': 'Shop GSTIN',
    'settings.shopAddress': 'Shop Address',
    'settings.shopState': 'Shop State',
    'settings.upiVpa': 'UPI VPA (e.g. shop@upi)',
    'settings.theme': 'Theme',
    'settings.darkMode': 'Dark Mode'
  },

  hi: {
    'app.name': 'ByteFix',
    'app.tagline': '\u092A\u094D\u0930\u094B\u092B\u0947\u0936\u0928\u0932 \u0915\u0902\u092A\u094D\u092F\u0942\u091F\u0930 \u0930\u093F\u092A\u0947\u092F\u0930 \u0914\u0930 \u0921\u093E\u092F\u0917\u094D\u0928\u094B\u0938\u094D\u091F\u093F\u0915\u094D\u0938',
    'nav.dashboard': '\u0921\u0948\u0936\u092C\u094B\u0930\u094D\u0921',
    'nav.diagnostics': '\u0921\u093E\u092F\u0917\u094D\u0928\u094B\u0938\u094D\u091F\u093F\u0915\u094D\u0938',
    'nav.performance': '\u092A\u094D\u0930\u0926\u0930\u094D\u0936\u0928',
    'nav.malware': '\u092E\u0948\u0932\u0935\u0947\u092F\u0930 \u0938\u094D\u0915\u0948\u0928',
    'nav.network': '\u0928\u0947\u091F\u0935\u0930\u094D\u0915',
    'nav.osRepair': 'OS \u092E\u0930\u092E\u094D\u092E\u0924',
    'nav.battery': '\u092C\u0948\u091F\u0930\u0940',
    'nav.diskHealth': '\u0921\u093F\u0938\u094D\u0915 \u0938\u094D\u0935\u093E\u0938\u094D\u0925\u094D\u092F',
    'nav.dataRecovery': '\u0921\u0947\u091F\u093E \u0930\u093F\u0915\u0935\u0930\u0940',
    'nav.passwordRecovery': '\u092A\u093E\u0938\u0935\u0930\u094D\u0921 \u0930\u093F\u0915\u0935\u0930\u0940',
    'nav.billing': 'GST \u092C\u093F\u0932\u093F\u0902\u0917',
    'nav.customers': '\u0917\u094D\u0930\u093E\u0939\u0915',
    'nav.repairJobs': '\u092E\u0930\u092E\u094D\u092E\u0924 \u0915\u093E\u0930\u094D\u092F',
    'nav.backup': '\u092C\u0948\u0915\u0905\u092A \u0935\u093F\u091C\u093C\u093E\u0930\u094D\u0921',
    'nav.settings': '\u0938\u0947\u091F\u093F\u0902\u0917\u094D\u0938',
    'nav.reports': '\u0930\u093F\u092A\u094B\u0930\u094D\u091F',
    'action.scan': '\u0938\u094D\u0915\u0948\u0928 \u0936\u0941\u0930\u0942 \u0915\u0930\u0947\u0902',
    'action.fix': '\u0911\u091F\u094B \u092B\u093F\u0915\u094D\u0938',
    'action.fixAll': '\u0938\u092D\u0940 \u0938\u092E\u0938\u094D\u092F\u093E\u090F\u0902 \u0920\u0940\u0915 \u0915\u0930\u0947\u0902',
    'action.cancel': '\u0930\u0926\u094D\u0926 \u0915\u0930\u0947\u0902',
    'action.save': '\u0938\u0947\u0935 \u0915\u0930\u0947\u0902',
    'action.delete': '\u0939\u091F\u093E\u090F\u0902',
    'action.edit': '\u0938\u0902\u092A\u093E\u0926\u093F\u0924 \u0915\u0930\u0947\u0902',
    'action.close': '\u092C\u0902\u0926 \u0915\u0930\u0947\u0902',
    'action.back': '\u0935\u093E\u092A\u0938',
    'action.next': '\u0906\u0917\u0947',
    'action.create': '\u092C\u0928\u093E\u090F\u0902',
    'action.update': '\u0905\u092A\u0921\u0947\u091F \u0915\u0930\u0947\u0902',
    'action.search': '\u0916\u094B\u091C\u0947\u0902',
    'action.export': '\u090F\u0915\u094D\u0938\u092A\u094B\u0930\u094D\u091F',
    'action.print': '\u092A\u094D\u0930\u093F\u0902\u091F \u0915\u0930\u0947\u0902',
    'action.download': '\u0921\u093E\u0909\u0928\u0932\u094B\u0921',
    'action.refresh': '\u0930\u093F\u092B\u094D\u0930\u0947\u0936',
    'action.retry': '\u092A\u0941\u0928\u0903 \u092A\u094D\u0930\u092F\u093E\u0938',
    'status.scanning': '\u0938\u094D\u0915\u0948\u0928 \u0939\u094B \u0930\u0939\u093E \u0939\u0948...',
    'status.fixing': '\u0920\u0940\u0915 \u0939\u094B \u0930\u0939\u093E \u0939\u0948...',
    'status.complete': '\u092A\u0942\u0930\u094D\u0923',
    'status.failed': '\u0935\u093F\u092B\u0932',
    'status.healthy': '\u0938\u094D\u0935\u0938\u094D\u0925',
    'status.warning': '\u091A\u0947\u0924\u093E\u0935\u0928\u0940',
    'status.critical': '\u0917\u0902\u092D\u0940\u0930',
    'status.pending': '\u0932\u0902\u092C\u093F\u0924',
    'status.inProgress': '\u092A\u094D\u0930\u0917\u0924\u093F \u092E\u0947\u0902',
    'status.ready': '\u0924\u0948\u092F\u093E\u0930',
    'job.received': '\u0921\u093F\u0935\u093E\u0907\u0938 \u092A\u094D\u0930\u093E\u092A\u094D\u0924',
    'job.diagnosing': '\u091C\u093E\u0902\u091A \u0939\u094B \u0930\u0939\u0940 \u0939\u0948',
    'job.waitingParts': '\u092A\u093E\u0930\u094D\u091F\u094D\u0938 \u0915\u093E \u0907\u0902\u0924\u091C\u093E\u0930',
    'job.repairInProgress': '\u092E\u0930\u092E\u094D\u092E\u0924 \u091C\u093E\u0930\u0940',
    'job.ready': '\u092A\u093F\u0915\u0905\u092A \u0915\u0947 \u0932\u093F\u090F \u0924\u0948\u092F\u093E\u0930',
    'job.delivered': '\u0926\u093F\u092F\u093E \u0917\u092F\u093E',
    'job.cancelled': '\u0930\u0926\u094D\u0926',
    'billing.invoice': '\u092C\u093F\u0932',
    'billing.createInvoice': '\u092C\u093F\u0932 \u092C\u0928\u093E\u090F\u0902',
    'billing.invoiceNumber': '\u092C\u093F\u0932 \u0928\u0902\u092C\u0930',
    'billing.subtotal': '\u0909\u092A-\u092F\u094B\u0917',
    'billing.cgst': 'CGST',
    'billing.sgst': 'SGST',
    'billing.igst': 'IGST',
    'billing.total': '\u0915\u0941\u0932',
    'billing.paid': '\u092D\u0941\u0917\u0924\u093E\u0928',
    'billing.unpaid': '\u0905\u092D\u0941\u0917\u0924\u093E\u0928',
    'billing.payViaUPI': 'UPI \u0938\u0947 \u092D\u0941\u0917\u0924\u093E\u0928 \u0915\u0930\u0947\u0902',
    'billing.generateQR': 'QR \u0915\u094B\u0921 \u092C\u0928\u093E\u090F\u0902',
    'customer.name': '\u0917\u094D\u0930\u093E\u0939\u0915 \u0915\u093E \u0928\u093E\u092E',
    'customer.phone': '\u092B\u094B\u0928 \u0928\u0902\u092C\u0930',
    'customer.email': '\u0908\u092E\u0947\u0932',
    'customer.address': '\u092A\u0924\u093E',
    'customer.gstin': 'GSTIN',
    'customer.addNew': '\u0928\u092F\u093E \u0917\u094D\u0930\u093E\u0939\u0915 \u091C\u094B\u0921\u093C\u0947\u0902',
    'customer.history': '\u0917\u094D\u0930\u093E\u0939\u0915 \u0907\u0924\u093F\u0939\u093E\u0938',
    'customer.totalVisits': '\u0915\u0941\u0932 \u0926\u094C\u0930\u0947',
    'device.brand': '\u0921\u093F\u0935\u093E\u0907\u0938 \u092C\u094D\u0930\u093E\u0902\u0921',
    'device.model': '\u0921\u093F\u0935\u093E\u0907\u0938 \u092E\u0949\u0921\u0932',
    'device.serial': '\u0938\u0940\u0930\u093F\u092F\u0932 \u0928\u0902\u092C\u0930',
    'device.complaint': '\u0936\u093F\u0915\u093E\u092F\u0924 / \u0938\u092E\u0938\u094D\u092F\u093E',
    'backup.title': '\u092C\u0948\u0915\u0905\u092A \u0935\u093F\u091C\u093C\u093E\u0930\u094D\u0921',
    'backup.createBackup': '\u092C\u0948\u0915\u0905\u092A \u092C\u0928\u093E\u090F\u0902',
    'backup.selectTargets': '\u092C\u0948\u0915\u0905\u092A \u0915\u0947 \u0932\u093F\u090F \u092B\u093E\u0907\u0932\u0947\u0902 \u091A\u0941\u0928\u0947\u0902',
    'backup.destination': '\u092C\u0948\u0915\u0905\u092A \u0917\u0902\u0924\u0935\u094D\u092F',
    'backup.browserData': '\u092C\u094D\u0930\u093E\u0909\u091C\u093C\u0930 \u0921\u0947\u091F\u093E',
    'backup.migrationGuide': '\u092E\u093E\u0907\u0917\u094D\u0930\u0947\u0936\u0928 \u0917\u093E\u0907\u0921',
    'backup.estimatedTime': '\u0905\u0928\u0941\u092E\u093E\u0928\u093F\u0924 \u0938\u092E\u092F',
    'backup.totalSize': '\u0915\u0941\u0932 \u0906\u0915\u093E\u0930',
    'diag.systemHealth': '\u0938\u093F\u0938\u094D\u091F\u092E \u0938\u094D\u0935\u093E\u0938\u094D\u0925\u094D\u092F \u0938\u094D\u0915\u094B\u0930',
    'diag.issuesFound': '\u0938\u092E\u0938\u094D\u092F\u093E\u090F\u0902 \u092E\u093F\u0932\u0940\u0902',
    'diag.fixesApplied': '\u0938\u0941\u0927\u093E\u0930 \u0932\u093E\u0917\u0942 \u0915\u093F\u090F',
    'diag.noIssues': '\u0915\u094B\u0908 \u0938\u092E\u0938\u094D\u092F\u093E \u0928\u0939\u0940\u0902 \u092E\u093F\u0932\u0940! \u0906\u092A\u0915\u093E \u0938\u093F\u0938\u094D\u091F\u092E \u0938\u094D\u0935\u0938\u094D\u0925 \u0939\u0948\u0964',
    'whatsapp.sendUpdate': 'WhatsApp \u0905\u092A\u0921\u0947\u091F \u092D\u0947\u091C\u0947\u0902',
    'whatsapp.sendPaymentLink': '\u092D\u0941\u0917\u0924\u093E\u0928 \u0932\u093F\u0902\u0915 \u092D\u0947\u091C\u0947\u0902',
    'whatsapp.sendReport': '\u0921\u093E\u092F\u0917\u094D\u0928\u094B\u0938\u094D\u091F\u093F\u0915 \u0930\u093F\u092A\u094B\u0930\u094D\u091F \u092D\u0947\u091C\u0947\u0902',
    'settings.language': '\u092D\u093E\u0937\u093E',
    'settings.shopName': '\u0926\u0941\u0915\u093E\u0928 \u0915\u093E \u0928\u093E\u092E',
    'settings.shopGstin': '\u0926\u0941\u0915\u093E\u0928 GSTIN',
    'settings.shopAddress': '\u0926\u0941\u0915\u093E\u0928 \u0915\u093E \u092A\u0924\u093E',
    'settings.shopState': '\u0926\u0941\u0915\u093E\u0928 \u0930\u093E\u091C\u094D\u092F',
    'settings.upiVpa': 'UPI VPA',
    'settings.theme': '\u0925\u0940\u092E',
    'settings.darkMode': '\u0921\u093E\u0930\u094D\u0915 \u092E\u094B\u0921'
  },

  ta: {
    'app.name': 'ByteFix',
    'app.tagline': '\u0BA4\u0BCA\u0BB4\u0BBF\u0BB2\u0BCD\u0BAE\u0BC1\u0BA9\u0BC8 \u0B95\u0BA3\u0BBF\u0BA9\u0BBF \u0BAA\u0BB4\u0BC1\u0BA4\u0BC1 \u0BAE\u0BB1\u0BCD\u0BB1\u0BC1\u0BAE\u0BCD \u0B95\u0BA3\u0BBF\u0B9A\u0BBE\u0BA9\u0BBF',
    'nav.dashboard': '\u0B9F\u0BBE\u0BB7\u0BCD\u0BAA\u0BCB\u0BB0\u0BCD\u0B9F\u0BCD',
    'nav.diagnostics': '\u0B95\u0BA3\u0BBF\u0B9A\u0BBE\u0BA9\u0BBF',
    'nav.performance': '\u0B9A\u0BC6\u0BAF\u0BB2\u0BCD\u0BA4\u0BBF\u0BB1\u0BA9\u0BCD',
    'nav.malware': '\u0BAE\u0BBE\u0BB2\u0BCD\u0BB5\u0BC7\u0BB0\u0BCD \u0B85\u0BB2\u0B9A\u0BB2\u0BCD',
    'nav.network': '\u0BA8\u0BC6\u0B9F\u0BCD\u0BB5\u0BB0\u0BCD\u0B95\u0BCD',
    'nav.osRepair': 'OS \u0BAA\u0BB4\u0BC1\u0BA4\u0BC1',
    'nav.battery': '\u0BAA\u0BC7\u0B9F\u0BCD\u0B9F\u0BB0\u0BBF',
    'nav.diskHealth': '\u0B9F\u0BBF\u0BB8\u0BCD\u0B95\u0BCD \u0BA8\u0BB2\u0BAE\u0BCD',
    'nav.dataRecovery': '\u0BA4\u0BB0\u0BB5\u0BC1 \u0BAE\u0BC0\u0B9F\u0BCD\u0BAA\u0BC1',
    'nav.passwordRecovery': '\u0B95\u0B9F\u0BB5\u0BC1\u0B9A\u0BCD\u0B9A\u0BCA\u0BB2\u0BCD \u0BAE\u0BC0\u0B9F\u0BCD\u0BAA\u0BC1',
    'nav.billing': 'GST \u0BAA\u0BBF\u0BB2\u0BCD\u0BB2\u0BBF\u0B99\u0BCD',
    'nav.customers': '\u0BB5\u0BBE\u0B9F\u0BBF\u0B95\u0BCD\u0B95\u0BC8\u0BAF\u0BBE\u0BB3\u0BB0\u0BCD\u0B95\u0BB3\u0BCD',
    'nav.repairJobs': '\u0BAA\u0BB4\u0BC1\u0BA4\u0BC1 \u0BB5\u0BC7\u0BB2\u0BC8\u0B95\u0BB3\u0BCD',
    'nav.backup': '\u0BAA\u0BC7\u0B95\u0BCD\u0B85\u0BAA\u0BCD \u0BB5\u0BBF\u0B9A\u0BBE\u0BB0\u0B9F\u0BCD',
    'nav.settings': '\u0B85\u0BAE\u0BC8\u0BAA\u0BCD\u0BAA\u0BC1\u0B95\u0BB3\u0BCD',
    'nav.reports': '\u0B85\u0BB1\u0BBF\u0B95\u0BCD\u0B95\u0BC8',
    'action.scan': '\u0B85\u0BB2\u0B9A\u0BB2\u0BCD \u0BA4\u0BCA\u0B9F\u0B99\u0BCD\u0B95\u0BC1',
    'action.fix': '\u0BA4\u0BBE\u0BA9\u0BBF\u0BAF\u0B99\u0BCD\u0B95\u0BBF \u0B9A\u0BB0\u0BBF\u0B9A\u0BC6\u0BAF\u0BCD',
    'action.fixAll': '\u0B85\u0BA9\u0BC8\u0BA4\u0BCD\u0BA4\u0BC1 \u0B9A\u0BBF\u0B95\u0BCD\u0B95\u0BB2\u0BCD\u0B95\u0BB3\u0BC8 \u0B9A\u0BB0\u0BBF\u0B9A\u0BC6\u0BAF\u0BCD',
    'action.cancel': '\u0BB0\u0BA4\u0BCD\u0BA4\u0BC1',
    'action.save': '\u0B9A\u0BC7\u0BAE\u0BBF',
    'action.delete': '\u0BA8\u0BC0\u0B95\u0BCD\u0B95\u0BC1',
    'action.search': '\u0BA4\u0BC7\u0B9F\u0BC1',
    'status.scanning': '\u0B85\u0BB2\u0B9A\u0BB2\u0BCD \u0B9A\u0BC6\u0BAF\u0BCD\u0BAF\u0BAA\u0BCD\u0BAA\u0B9F\u0BC1\u0B95\u0BBF\u0BB1\u0BA4\u0BC1...',
    'status.complete': '\u0BAE\u0BC1\u0B9F\u0BBF\u0BA8\u0BCD\u0BA4\u0BA4\u0BC1',
    'status.failed': '\u0BA4\u0BCB\u0BB2\u0BCD\u0BB5\u0BBF',
    'status.healthy': '\u0BA8\u0BB2\u0BAE\u0BCD',
    'status.warning': '\u0B8E\u0B9A\u0BCD\u0B9A\u0BB0\u0BBF\u0B95\u0BCD\u0B95\u0BC8',
    'status.critical': '\u0B85\u0BAA\u0BBE\u0BAF\u0B95\u0BB0\u0BAE\u0BBE\u0BA9',
    'job.received': '\u0B9A\u0BBE\u0BA4\u0BA9\u0BAE\u0BCD \u0BAA\u0BC6\u0BB1\u0BCD\u0BB1\u0BA4\u0BC1',
    'job.diagnosing': '\u0B95\u0BA3\u0BBF\u0B9A\u0BBE\u0BA9\u0BBF \u0B9A\u0BC6\u0BAF\u0BCD\u0BAF\u0BAA\u0BCD\u0BAA\u0B9F\u0BC1\u0B95\u0BBF\u0BB1\u0BA4\u0BC1',
    'job.waitingParts': '\u0BAA\u0BBE\u0B95\u0B99\u0BCD\u0B95\u0BB3\u0BC1\u0B95\u0BCD\u0B95\u0BBE\u0B95 \u0B95\u0BBE\u0BA4\u0BCD\u0BA4\u0BBF\u0BB0\u0BC1\u0B95\u0BCD\u0B95\u0BBF\u0BB1\u0BA4\u0BC1',
    'job.ready': '\u0B8E\u0B9F\u0BC1\u0B95\u0BCD\u0B95 \u0BA4\u0BAF\u0BBE\u0BB0\u0BCD',
    'job.delivered': '\u0BB5\u0BB4\u0B99\u0BCD\u0B95\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BA4\u0BC1',
    'billing.invoice': '\u0BAA\u0BBF\u0BB2\u0BCD',
    'billing.total': '\u0BAE\u0BCA\u0BA4\u0BCD\u0BA4\u0BAE\u0BCD',
    'customer.name': '\u0BB5\u0BBE\u0B9F\u0BBF\u0B95\u0BCD\u0B95\u0BC8\u0BAF\u0BBE\u0BB3\u0BB0\u0BCD \u0BAA\u0BC6\u0BAF\u0BB0\u0BCD',
    'customer.phone': '\u0BAA\u0BCB\u0BA9\u0BCD \u0B8E\u0BA3\u0BCD',
    'settings.language': '\u0BAE\u0BCA\u0BB4\u0BBF'
  },

  te: {
    'app.name': 'ByteFix',
    'app.tagline': '\u0C35\u0C43\u0C24\u0C4D\u0C24\u0C3F\u0C2A\u0C30\u0C2E\u0C48\u0C28 \u0C15\u0C02\u0C2A\u0C4D\u0C2F\u0C42\u0C1F\u0C30\u0C4D \u0C30\u0C3F\u0C2A\u0C47\u0C30\u0C4D \u0C2E\u0C30\u0C3F\u0C2F\u0C41 \u0C21\u0C2F\u0C3E\u0C17\u0C4D\u0C28\u0C4B\u0C38\u0C4D\u0C1F\u0C3F\u0C15\u0C4D\u0C38\u0C4D',
    'nav.dashboard': '\u0C21\u0C4D\u0C2F\u0C3E\u0C37\u0C4D\u200C\u0C2C\u0C4B\u0C30\u0C4D\u0C21\u0C4D',
    'nav.diagnostics': '\u0C21\u0C2F\u0C3E\u0C17\u0C4D\u0C28\u0C4B\u0C38\u0C4D\u0C1F\u0C3F\u0C15\u0C4D\u0C38\u0C4D',
    'nav.performance': '\u0C2A\u0C4D\u0C30\u0C26\u0C30\u0C4D\u0C36\u0C28',
    'nav.billing': 'GST \u0C2C\u0C3F\u0C32\u0C4D\u0C32\u0C3F\u0C02\u0C17\u0C4D',
    'nav.customers': '\u0C15\u0C38\u0C4D\u0C1F\u0C2E\u0C30\u0C4D\u0C32\u0C41',
    'nav.repairJobs': '\u0C30\u0C3F\u0C2A\u0C47\u0C30\u0C4D \u0C2A\u0C28\u0C41\u0C32\u0C41',
    'nav.settings': '\u0C38\u0C46\u0C1F\u0C4D\u0C1F\u0C3F\u0C02\u0C17\u0C4D\u200C\u0C32\u0C41',
    'action.scan': '\u0C38\u0C4D\u0C15\u0C4D\u0C2F\u0C3E\u0C28\u0C4D \u0C2A\u0C4D\u0C30\u0C3E\u0C30\u0C02\u0C2D\u0C3F\u0C02\u0C1A\u0C02\u0C21\u0C3F',
    'action.fix': '\u0C06\u0C1F\u0C4B \u0C2B\u0C3F\u0C15\u0C4D\u0C38\u0C4D',
    'status.complete': '\u0C2A\u0C42\u0C30\u0C4D\u0C24\u0C2F\u0C3F\u0C02\u0C26\u0C3F',
    'status.healthy': '\u0C06\u0C30\u0C4B\u0C17\u0C4D\u0C2F\u0C02\u0C17\u0C3E \u0C09\u0C02\u0C26\u0C3F',
    'job.received': '\u0C2A\u0C30\u0C3F\u0C15\u0C30\u0C02 \u0C05\u0C02\u0C26\u0C41\u0C15\u0C41\u0C28\u0C4D\u0C28\u0C26\u0C3F',
    'job.ready': '\u0C2A\u0C3F\u0C15\u0C05\u0C2A\u0C4D \u0C15\u0C4B\u0C38\u0C02 \u0C38\u0C3F\u0C26\u0C4D\u0C27\u0C02',
    'billing.invoice': '\u0C2C\u0C3F\u0C32\u0C4D\u0C32\u0C41',
    'billing.total': '\u0C2E\u0C4A\u0C24\u0C4D\u0C24\u0C02',
    'customer.name': '\u0C15\u0C38\u0C4D\u0C1F\u0C2E\u0C30\u0C4D \u0C2A\u0C47\u0C30\u0C41',
    'customer.phone': '\u0C2B\u0C4B\u0C28\u0C4D \u0C28\u0C02\u0C2C\u0C30\u0C4D',
    'settings.language': '\u0C2D\u0C3E\u0C37'
  },

  bn: {
    'app.name': 'ByteFix',
    'app.tagline': '\u09AA\u09C7\u09B6\u09BE\u09A6\u09BE\u09B0 \u0995\u09AE\u09CD\u09AA\u09BF\u0989\u099F\u09BE\u09B0 \u09AE\u09C7\u09B0\u09BE\u09AE\u09A4 \u098F\u09AC\u0982 \u09A1\u09BE\u09AF\u09BC\u09BE\u0997\u09A8\u09B8\u09CD\u099F\u09BF\u0995\u09CD\u09B8',
    'nav.dashboard': '\u09A1\u09CD\u09AF\u09BE\u09B6\u09AC\u09CB\u09B0\u09CD\u09A1',
    'nav.diagnostics': '\u09A1\u09BE\u09AF\u09BC\u09BE\u0997\u09A8\u09B8\u09CD\u099F\u09BF\u0995\u09CD\u09B8',
    'nav.billing': 'GST \u09AC\u09BF\u09B2\u09BF\u0982',
    'nav.customers': '\u0997\u09CD\u09B0\u09BE\u09B9\u0995',
    'nav.repairJobs': '\u09AE\u09C7\u09B0\u09BE\u09AE\u09A4 \u0995\u09BE\u099C',
    'nav.settings': '\u09B8\u09C7\u099F\u09BF\u0982\u09B8',
    'action.scan': '\u09B8\u09CD\u0995\u09CD\u09AF\u09BE\u09A8 \u09B6\u09C1\u09B0\u09C1 \u0995\u09B0\u09C1\u09A8',
    'action.fix': '\u0985\u099F\u09CB \u09AB\u09BF\u0995\u09CD\u09B8',
    'status.complete': '\u09B8\u09AE\u09CD\u09AA\u09C2\u09B0\u09CD\u09A3',
    'status.healthy': '\u09B8\u09C1\u09B8\u09CD\u09A5',
    'job.received': '\u09A1\u09BF\u09AD\u09BE\u0987\u09B8 \u09AA\u09CD\u09B0\u09BE\u09AA\u09CD\u09A4',
    'job.ready': '\u09AA\u09BF\u0995\u0986\u09AA\u09C7\u09B0 \u099C\u09A8\u09CD\u09AF \u09AA\u09CD\u09B0\u09B8\u09CD\u09A4\u09C1\u09A4',
    'billing.invoice': '\u099A\u09BE\u09B2\u09BE\u09A8',
    'billing.total': '\u09AE\u09CB\u099F',
    'customer.name': '\u0997\u09CD\u09B0\u09BE\u09B9\u0995\u09C7\u09B0 \u09A8\u09BE\u09AE',
    'customer.phone': '\u09AB\u09CB\u09A8 \u09A8\u09AE\u09CD\u09AC\u09B0',
    'settings.language': '\u09AD\u09BE\u09B7\u09BE'
  },

  mr: {
    'app.name': 'ByteFix',
    'app.tagline': '\u0935\u094D\u092F\u093E\u0935\u0938\u093E\u092F\u093F\u0915 \u0915\u0902\u092A\u094D\u092F\u0942\u091F\u0930 \u0926\u0941\u0930\u0941\u0938\u094D\u0924\u0940 \u0906\u0923\u093F \u0928\u093F\u0926\u093E\u0928',
    'nav.dashboard': '\u0921\u0945\u0936\u092C\u094B\u0930\u094D\u0921',
    'nav.diagnostics': '\u0928\u093F\u0926\u093E\u0928',
    'nav.billing': 'GST \u092C\u093F\u0932\u093F\u0902\u0917',
    'nav.customers': '\u0917\u094D\u0930\u093E\u0939\u0915',
    'nav.repairJobs': '\u0926\u0941\u0930\u0941\u0938\u094D\u0924\u0940 \u0915\u093E\u092E\u0947',
    'nav.settings': '\u0938\u0947\u091F\u093F\u0902\u0917\u094D\u0938',
    'action.scan': '\u0938\u094D\u0915\u0945\u0928 \u0938\u0941\u0930\u0942 \u0915\u0930\u093E',
    'action.fix': '\u0911\u091F\u094B \u092B\u093F\u0915\u094D\u0938',
    'status.complete': '\u092A\u0942\u0930\u094D\u0923',
    'status.healthy': '\u0928\u093F\u0930\u094B\u0917\u0940',
    'job.received': '\u0909\u092A\u0915\u0930\u0923 \u092A\u094D\u0930\u093E\u092A\u094D\u0924',
    'job.ready': '\u092A\u093F\u0915\u0905\u092A\u0938\u093E\u0920\u0940 \u0924\u092F\u093E\u0930',
    'billing.invoice': '\u092C\u093F\u0932',
    'billing.total': '\u090F\u0915\u0942\u0923',
    'customer.name': '\u0917\u094D\u0930\u093E\u0939\u0915\u093E\u091A\u0947 \u0928\u093E\u0935',
    'customer.phone': '\u092B\u094B\u0928 \u0928\u0902\u092C\u0930',
    'settings.language': '\u092D\u093E\u0937\u093E'
  },

  kn: {
    'app.name': 'ByteFix',
    'app.tagline': '\u0CB5\u0CC3\u0CA4\u0CCD\u0CA4\u0CBF\u0CAA\u0CB0 \u0C95\u0C82\u0CAA\u0CCD\u0CAF\u0CC2\u0C9F\u0CB0\u0CCD \u0CA6\u0CC1\u0CB0\u0CB8\u0CCD\u0CA4\u0CBF \u0CAE\u0CA4\u0CCD\u0CA4\u0CC1 \u0CB0\u0CCB\u0C97\u0CA8\u0CBF\u0CB0\u0CCD\u0CA3\u0CAF',
    'nav.dashboard': '\u0CA1\u0CCD\u0CAF\u0CBE\u0CB6\u0CCD\u200C\u0CAC\u0CCB\u0CB0\u0CCD\u0CA1\u0CCD',
    'nav.diagnostics': '\u0CB0\u0CCB\u0C97\u0CA8\u0CBF\u0CB0\u0CCD\u0CA3\u0CAF',
    'nav.billing': 'GST \u0CAC\u0CBF\u0CB2\u0CCD\u0CB2\u0CBF\u0C82\u0C97\u0CCD',
    'nav.customers': '\u0C97\u0CCD\u0CB0\u0CBE\u0CB9\u0C95\u0CB0\u0CC1',
    'nav.repairJobs': '\u0CA6\u0CC1\u0CB0\u0CB8\u0CCD\u0CA4\u0CBF \u0C95\u0CC6\u0CB2\u0CB8\u0C97\u0CB3\u0CC1',
    'nav.settings': '\u0CB8\u0CC6\u0C9F\u0CCD\u0C9F\u0CBF\u0C82\u0C97\u0CCD\u200C\u0C97\u0CB3\u0CC1',
    'action.scan': '\u0CB8\u0CCD\u0C95\u0CCD\u0CAF\u0CBE\u0CA8\u0CCD \u0CAA\u0CCD\u0CB0\u0CBE\u0CB0\u0C82\u0CAD\u0CBF\u0CB8\u0CBF',
    'action.fix': '\u0C86\u0C9F\u0CCB \u0CAB\u0CBF\u0C95\u0CCD\u0CB8\u0CCD',
    'status.complete': '\u0CAA\u0CC2\u0CB0\u0CCD\u0CA3',
    'status.healthy': '\u0C86\u0CB0\u0CCB\u0C97\u0CCD\u0CAF\u0C95\u0CB0',
    'job.received': '\u0CB8\u0CBE\u0CA7\u0CA8 \u0CB8\u0CCD\u0CB5\u0CC0\u0C95\u0CB0\u0CBF\u0CB8\u0CB2\u0CBE\u0C97\u0CBF\u0CA6\u0CC6',
    'job.ready': '\u0CAA\u0CBF\u0C95\u0C85\u0CAA\u0CCD\u200C\u0C97\u0CC6 \u0CB8\u0CBF\u0CA6\u0CCD\u0CA7',
    'billing.invoice': '\u0CAC\u0CBF\u0CB2\u0CCD\u0CB2\u0CC1',
    'billing.total': '\u0C92\u0C9F\u0CCD\u0C9F\u0CC1',
    'customer.name': '\u0C97\u0CCD\u0CB0\u0CBE\u0CB9\u0C95\u0CB0 \u0CB9\u0CC6\u0CB8\u0CB0\u0CC1',
    'customer.phone': '\u0CAB\u0CCB\u0CA8\u0CCD \u0CB8\u0C82\u0C96\u0CCD\u0CAF\u0CC6',
    'settings.language': '\u0CAD\u0CBE\u0CB7\u0CC6'
  }
}

// ============================================================
// Translation Function
// ============================================================

let currentLanguage: SupportedLanguage = 'en'

export function setLanguage(lang: SupportedLanguage): void {
  currentLanguage = lang
  try {
    saveSetting('bytefix_language', lang)
  } catch {
    // Database may not be initialized yet
  }
  logger.info('Language set', { language: lang })
}

export function getLanguage(): SupportedLanguage {
  return currentLanguage
}

export function loadSavedLanguage(): SupportedLanguage {
  try {
    const saved = getSetting('bytefix_language') as SupportedLanguage | undefined
    if (saved && translations[saved]) {
      currentLanguage = saved
      return saved
    }
  } catch {
    // Database may not be initialized yet
  }
  return 'en'
}

export function t(key: string, fallback?: string): string {
  // Try current language first
  const langDict = translations[currentLanguage]
  if (langDict && langDict[key]) {
    return langDict[key]
  }
  // Fallback to English
  if (translations.en[key]) {
    return translations.en[key]
  }
  // Fallback to provided fallback or key itself
  return fallback || key
}

export function getSupportedLanguages(): LanguageInfo[] {
  return SUPPORTED_LANGUAGES
}

export function getTranslationsForLanguage(lang: SupportedLanguage): TranslationDictionary {
  return { ...translations.en, ...translations[lang] }
}

export function getAllTranslationKeys(): string[] {
  return Object.keys(translations.en)
}
