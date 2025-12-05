import { Injectable, signal, computed } from '@angular/core';
import { Subject } from 'rxjs';

export type CloudProvider = 'aws-s3' | 'google-cloud' | 'azure-blob' | 'dropbox' | 'onedrive' | 'backblaze-b2' | 'wasabi' | 'cloudflare-r2';

export interface CloudStorageAccount {
  id: string;
  name: string;
  provider: CloudProvider;
  connected: boolean;
  status: 'connected' | 'disconnected' | 'error' | 'auth-required';

  // Credentials (encrypted in production)
  credentials: CloudCredentials;

  // Configuration
  config: StorageConfig;

  // Statistics
  stats: StorageStats;

  // Timestamps
  connectedAt?: Date;
  lastSyncAt?: Date;
  lastErrorAt?: Date;
  lastError?: string;
}

export interface CloudCredentials {
  // AWS S3
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;

  // Google Cloud Storage
  projectId?: string;
  privateKey?: string;
  clientEmail?: string;

  // Azure Blob Storage
  accountName?: string;
  accountKey?: string;

  // Dropbox / OneDrive
  accessToken?: string;
  refreshToken?: string;

  // Backblaze B2
  applicationKeyId?: string;
  applicationKey?: string;

  // Wasabi
  endpoint?: string;

  // Cloudflare R2
  accountId?: string;
  bucketName?: string;
}

export interface StorageConfig {
  // General
  bucket: string;
  prefix?: string; // Folder prefix (e.g., "recordings/")
  public: boolean;

  // Auto-upload
  autoUploadRecordings: boolean;
  autoUploadScreenshots: boolean;
  autoUploadThumbnails: boolean;
  autoUploadCaptions: boolean;

  // Retention
  deleteLocalAfterUpload: boolean;
  retentionDays?: number; // Auto-delete after X days (0 = never)

  // Bandwidth
  maxUploadBandwidth?: number; // kbps (0 = unlimited)
  maxConcurrentUploads: number;

  // Format
  compression: boolean;
  compressionQuality: number; // 0-100
}

export interface StorageStats {
  totalFiles: number;
  totalSize: number; // bytes
  uploadedFiles: number;
  uploadedSize: number; // bytes
  failedUploads: number;
  bandwidth: number; // kbps
  storageUsed: number; // bytes
  storageLimit?: number; // bytes (provider limit)
}

export interface UploadTask {
  id: string;
  accountId: string;
  file: File | Blob;
  fileName: string;
  filePath: string;
  fileSize: number;
  fileType: string;

  // Progress
  status: 'queued' | 'uploading' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  uploadedBytes: number;
  uploadSpeed: number; // kbps

  // Error
  error?: string;
  retryCount: number;
  maxRetries: number;

  // Timestamps
  queuedAt: Date;
  startedAt?: Date;
  completedAt?: Date;

  // Result
  url?: string;
  publicUrl?: string;
}

export interface StoredFile {
  id: string;
  accountId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  fileType: string;
  url: string;
  publicUrl?: string;
  uploadedAt: Date;
  expiresAt?: Date;
}

const DEFAULT_CONFIG: Omit<StorageConfig, 'bucket'> = {
  prefix: 'broadboi/',
  public: false,
  autoUploadRecordings: true,
  autoUploadScreenshots: false,
  autoUploadThumbnails: true,
  autoUploadCaptions: false,
  deleteLocalAfterUpload: false,
  maxConcurrentUploads: 3,
  compression: true,
  compressionQuality: 85,
};

@Injectable({
  providedIn: 'root',
})
export class CloudStorageService {
  private readonly STORAGE_KEY = 'broadboi-cloud-storage';
  private readonly UPLOAD_QUEUE_SIZE = 100;

  // Upload queue
  private readonly uploadQueue: UploadTask[] = [];
  private readonly activeUploads = new Map<string, AbortController>();

  // Reactive state
  readonly accounts = signal<CloudStorageAccount[]>([]);
  readonly uploadTasks = signal<UploadTask[]>([]);
  readonly storedFiles = signal<StoredFile[]>([]);

  // Computed
  readonly connectedAccounts = computed(() =>
    this.accounts().filter(a => a.connected)
  );
  readonly activeUploads$ = computed(() =>
    this.uploadTasks().filter(t => t.status === 'uploading')
  );
  readonly queuedUploads = computed(() =>
    this.uploadTasks().filter(t => t.status === 'queued')
  );
  readonly completedUploads = computed(() =>
    this.uploadTasks().filter(t => t.status === 'completed')
  );
  readonly failedUploads = computed(() =>
    this.uploadTasks().filter(t => t.status === 'failed')
  );
  readonly totalUploadProgress = computed(() => {
    const tasks = this.uploadTasks();
    if (tasks.length === 0) return 0;

    const totalProgress = tasks.reduce((sum, t) => sum + t.progress, 0);
    return Math.round(totalProgress / tasks.length);
  });

  // Events
  private readonly accountConnectedSubject = new Subject<CloudStorageAccount>();
  private readonly accountDisconnectedSubject = new Subject<CloudStorageAccount>();
  private readonly uploadStartedSubject = new Subject<UploadTask>();
  private readonly uploadProgressSubject = new Subject<UploadTask>();
  private readonly uploadCompletedSubject = new Subject<UploadTask>();
  private readonly uploadFailedSubject = new Subject<UploadTask>();

  public readonly accountConnected$ = this.accountConnectedSubject.asObservable();
  public readonly accountDisconnected$ = this.accountDisconnectedSubject.asObservable();
  public readonly uploadStarted$ = this.uploadStartedSubject.asObservable();
  public readonly uploadProgress$ = this.uploadProgressSubject.asObservable();
  public readonly uploadCompleted$ = this.uploadCompletedSubject.asObservable();
  public readonly uploadFailed$ = this.uploadFailedSubject.asObservable();

  constructor() {
    this.loadAccounts();
    this.processUploadQueue();
  }

  // ============ ACCOUNT MANAGEMENT ============

  /**
   * Add cloud storage account
   */
  async addAccount(
    name: string,
    provider: CloudProvider,
    credentials: CloudCredentials,
    config: Partial<StorageConfig> & Pick<StorageConfig, 'bucket'>
  ): Promise<string> {
    const id = this.generateId('account');

    const account: CloudStorageAccount = {
      id,
      name,
      provider,
      connected: false,
      status: 'disconnected',
      credentials,
      config: { ...DEFAULT_CONFIG, ...config },
      stats: this.getInitialStats(),
    };

    // Test connection
    try {
      await this.testConnection(account);
      account.connected = true;
      account.status = 'connected';
      account.connectedAt = new Date();
      this.accountConnectedSubject.next(account);
    } catch (error) {
      account.status = 'error';
      account.lastError = (error as Error).message;
      account.lastErrorAt = new Date();
    }

    this.accounts.update(accounts => [...accounts, account]);
    this.saveAccounts();

    return id;
  }

  /**
   * Update account
   */
  updateAccount(id: string, updates: Partial<CloudStorageAccount>): void {
    this.accounts.update(accounts =>
      accounts.map(a => (a.id === id ? { ...a, ...updates } : a))
    );
    this.saveAccounts();
  }

  /**
   * Remove account
   */
  removeAccount(id: string): void {
    // Cancel any active uploads for this account
    const accountTasks = this.uploadTasks().filter(t => t.accountId === id);
    for (const task of accountTasks) {
      this.cancelUpload(task.id);
    }

    this.accounts.update(accounts => accounts.filter(a => a.id !== id));
    this.saveAccounts();
  }

  /**
   * Test connection to cloud provider
   */
  async testConnection(account: CloudStorageAccount): Promise<boolean> {
    // In a real implementation, this would test the connection
    // For now, simulate a successful test
    await new Promise(resolve => setTimeout(resolve, 500));
    return true;
  }

  /**
   * Reconnect account
   */
  async reconnectAccount(id: string): Promise<void> {
    const account = this.accounts().find(a => a.id === id);
    if (!account) return;

    try {
      await this.testConnection(account);
      this.updateAccount(id, {
        connected: true,
        status: 'connected',
        connectedAt: new Date(),
        lastError: undefined,
      });
      this.accountConnectedSubject.next(account);
    } catch (error) {
      this.updateAccount(id, {
        status: 'error',
        lastError: (error as Error).message,
        lastErrorAt: new Date(),
      });
      throw error;
    }
  }

  // ============ FILE UPLOAD ============

  /**
   * Upload file
   */
  async uploadFile(
    accountId: string,
    file: File | Blob,
    fileName: string,
    filePath?: string
  ): Promise<UploadTask> {
    const account = this.accounts().find(a => a.id === accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    if (!account.connected) {
      throw new Error('Account not connected');
    }

    const taskId = this.generateId('upload');
    const task: UploadTask = {
      id: taskId,
      accountId,
      file,
      fileName,
      filePath: filePath || `${account.config.prefix}${fileName}`,
      fileSize: file.size,
      fileType: file.type,
      status: 'queued',
      progress: 0,
      uploadedBytes: 0,
      uploadSpeed: 0,
      retryCount: 0,
      maxRetries: 3,
      queuedAt: new Date(),
    };

    this.uploadTasks.update(tasks => [...tasks, task]);
    this.uploadQueue.push(task);

    return task;
  }

  /**
   * Upload multiple files
   */
  async uploadFiles(
    accountId: string,
    files: Array<{ file: File | Blob; fileName: string; filePath?: string }>
  ): Promise<UploadTask[]> {
    const tasks: UploadTask[] = [];

    for (const { file, fileName, filePath } of files) {
      const task = await this.uploadFile(accountId, file, fileName, filePath);
      tasks.push(task);
    }

    return tasks;
  }

  /**
   * Cancel upload
   */
  cancelUpload(taskId: string): void {
    const controller = this.activeUploads.get(taskId);
    if (controller) {
      controller.abort();
      this.activeUploads.delete(taskId);
    }

    this.updateUploadTask(taskId, { status: 'cancelled' });
  }

  /**
   * Retry failed upload
   */
  async retryUpload(taskId: string): Promise<void> {
    const task = this.uploadTasks().find(t => t.id === taskId);
    if (!task || task.status !== 'failed') return;

    task.status = 'queued';
    task.progress = 0;
    task.uploadedBytes = 0;
    task.error = undefined;
    task.retryCount++;

    this.uploadTasks.update(tasks =>
      tasks.map(t => (t.id === taskId ? task : t))
    );

    this.uploadQueue.push(task);
  }

  // ============ FILE MANAGEMENT ============

  /**
   * List files in account
   */
  async listFiles(accountId: string, prefix?: string): Promise<StoredFile[]> {
    const account = this.accounts().find(a => a.id === accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    // In a real implementation, this would list files from the cloud provider
    return this.storedFiles().filter(f => f.accountId === accountId);
  }

  /**
   * Delete file
   */
  async deleteFile(fileId: string): Promise<void> {
    const file = this.storedFiles().find(f => f.id === fileId);
    if (!file) return;

    // In a real implementation, this would delete from the cloud provider
    this.storedFiles.update(files => files.filter(f => f.id !== fileId));
  }

  /**
   * Get file URL
   */
  getFileUrl(fileId: string, expiresIn?: number): string {
    const file = this.storedFiles().find(f => f.id === fileId);
    if (!file) {
      throw new Error('File not found');
    }

    // In a real implementation, this would generate a signed URL
    return file.url;
  }

  /**
   * Get public URL
   */
  getPublicUrl(fileId: string): string {
    const file = this.storedFiles().find(f => f.id === fileId);
    if (!file || !file.publicUrl) {
      throw new Error('Public URL not available');
    }

    return file.publicUrl;
  }

  // ============ UPLOAD PROCESSING ============

  /**
   * Process upload queue
   */
  private processUploadQueue(): void {
    setInterval(() => {
      this.processNextUpload();
    }, 1000);
  }

  /**
   * Process next upload in queue
   */
  private async processNextUpload(): Promise<void> {
    const activeCount = this.activeUploads$.().length;
    const maxConcurrent = this.getMaxConcurrentUploads();

    if (activeCount >= maxConcurrent || this.uploadQueue.length === 0) {
      return;
    }

    const task = this.uploadQueue.shift();
    if (!task) return;

    await this.executeUpload(task);
  }

  /**
   * Execute upload
   */
  private async executeUpload(task: UploadTask): Promise<void> {
    const account = this.accounts().find(a => a.id === task.accountId);
    if (!account) {
      this.updateUploadTask(task.id, {
        status: 'failed',
        error: 'Account not found',
      });
      return;
    }

    const controller = new AbortController();
    this.activeUploads.set(task.id, controller);

    this.updateUploadTask(task.id, {
      status: 'uploading',
      startedAt: new Date(),
    });

    this.uploadStartedSubject.next(task);

    try {
      // In a real implementation, this would upload to the cloud provider
      // For now, simulate upload with progress
      await this.simulateUpload(task, controller.signal);

      const url = `https://${account.provider}.example.com/${task.filePath}`;
      const publicUrl = account.config.public ? url : undefined;

      this.updateUploadTask(task.id, {
        status: 'completed',
        progress: 100,
        completedAt: new Date(),
        url,
        publicUrl,
      });

      // Add to stored files
      const storedFile: StoredFile = {
        id: this.generateId('file'),
        accountId: task.accountId,
        fileName: task.fileName,
        filePath: task.filePath,
        fileSize: task.fileSize,
        fileType: task.fileType,
        url,
        publicUrl,
        uploadedAt: new Date(),
      };

      this.storedFiles.update(files => [...files, storedFile]);
      this.uploadCompletedSubject.next(task);

      // Update account stats
      account.stats.uploadedFiles++;
      account.stats.uploadedSize += task.fileSize;
      account.stats.totalFiles++;
      account.stats.totalSize += task.fileSize;
      account.lastSyncAt = new Date();

      this.updateAccount(account.id, { stats: account.stats });
    } catch (error) {
      const errorMessage = (error as Error).message;

      this.updateUploadTask(task.id, {
        status: 'failed',
        error: errorMessage,
      });

      this.uploadFailedSubject.next(task);

      // Retry if possible
      if (task.retryCount < task.maxRetries) {
        await this.retryUpload(task.id);
      }
    } finally {
      this.activeUploads.delete(task.id);
    }
  }

  /**
   * Simulate upload (for demonstration)
   */
  private async simulateUpload(task: UploadTask, signal: AbortSignal): Promise<void> {
    const chunks = 20;
    const chunkSize = task.fileSize / chunks;
    const chunkDuration = 100; // ms per chunk

    for (let i = 0; i < chunks; i++) {
      if (signal.aborted) {
        throw new Error('Upload cancelled');
      }

      await new Promise(resolve => setTimeout(resolve, chunkDuration));

      const progress = ((i + 1) / chunks) * 100;
      const uploadedBytes = (i + 1) * chunkSize;
      const uploadSpeed = (chunkSize * 8) / (chunkDuration / 1000) / 1000; // kbps

      this.updateUploadTask(task.id, {
        progress: Math.round(progress),
        uploadedBytes: Math.round(uploadedBytes),
        uploadSpeed: Math.round(uploadSpeed),
      });

      this.uploadProgressSubject.next(task);
    }
  }

  /**
   * Update upload task
   */
  private updateUploadTask(id: string, updates: Partial<UploadTask>): void {
    this.uploadTasks.update(tasks =>
      tasks.map(t => (t.id === id ? { ...t, ...updates } : t))
    );
  }

  /**
   * Get max concurrent uploads
   */
  private getMaxConcurrentUploads(): number {
    const accounts = this.connectedAccounts();
    if (accounts.length === 0) return 3;

    return Math.min(...accounts.map(a => a.config.maxConcurrentUploads));
  }

  // ============ PROVIDERS ============

  /**
   * Get supported providers
   */
  getSupportedProviders(): Array<{
    id: CloudProvider;
    name: string;
    description: string;
    pricing: string;
  }> {
    return [
      {
        id: 'aws-s3',
        name: 'Amazon S3',
        description: 'Industry-standard object storage',
        pricing: '$0.023/GB/month',
      },
      {
        id: 'google-cloud',
        name: 'Google Cloud Storage',
        description: 'Fast and secure object storage',
        pricing: '$0.020/GB/month',
      },
      {
        id: 'azure-blob',
        name: 'Azure Blob Storage',
        description: 'Microsoft Azure storage solution',
        pricing: '$0.018/GB/month',
      },
      {
        id: 'backblaze-b2',
        name: 'Backblaze B2',
        description: 'Affordable cloud storage',
        pricing: '$0.005/GB/month',
      },
      {
        id: 'wasabi',
        name: 'Wasabi',
        description: 'Fast and affordable',
        pricing: '$5.99/TB/month',
      },
      {
        id: 'cloudflare-r2',
        name: 'Cloudflare R2',
        description: 'Zero egress fees',
        pricing: '$0.015/GB/month',
      },
      {
        id: 'dropbox',
        name: 'Dropbox',
        description: 'Personal cloud storage',
        pricing: 'Free - $20/month',
      },
      {
        id: 'onedrive',
        name: 'OneDrive',
        description: 'Microsoft cloud storage',
        pricing: 'Free - $10/month',
      },
    ];
  }

  // ============ UTILITIES ============

  /**
   * Get initial statistics
   */
  private getInitialStats(): StorageStats {
    return {
      totalFiles: 0,
      totalSize: 0,
      uploadedFiles: 0,
      uploadedSize: 0,
      failedUploads: 0,
      bandwidth: 0,
      storageUsed: 0,
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Load accounts from storage
   */
  private loadAccounts(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const accounts = JSON.parse(stored);
        // Reset connection status on load
        this.accounts.set(
          accounts.map((a: CloudStorageAccount) => ({
            ...a,
            connected: false,
            status: 'disconnected',
          }))
        );
      }
    } catch (error) {
      console.error('Failed to load cloud storage accounts:', error);
    }
  }

  /**
   * Save accounts to storage
   */
  private saveAccounts(): void {
    try {
      // Don't save credentials in production (use secure storage)
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.accounts()));
    } catch (error) {
      console.error('Failed to save cloud storage accounts:', error);
    }
  }

  /**
   * Clear completed uploads
   */
  clearCompletedUploads(): void {
    this.uploadTasks.update(tasks =>
      tasks.filter(t => t.status !== 'completed')
    );
  }

  /**
   * Clear all uploads
   */
  clearAllUploads(): void {
    // Cancel active uploads
    for (const [id, controller] of this.activeUploads.entries()) {
      controller.abort();
    }

    this.activeUploads.clear();
    this.uploadQueue.length = 0;
    this.uploadTasks.set([]);
  }
}
