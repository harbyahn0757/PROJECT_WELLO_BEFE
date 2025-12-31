/**
 * NotificationService - 모바일 알림 시스템
 * 건강 관련 알림을 관리하는 서비스
 */

export interface HealthNotification {
  id: string;
  type: 'checkup_reminder' | 'abnormal_value' | 'medication_reminder' | 'health_tip' | 'system';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: Date;
  readAt?: Date;
  actionUrl?: string;
  actionLabel?: string;
  data?: any;
}

export interface NotificationSettings {
  checkupReminders: boolean;
  abnormalValueAlerts: boolean;
  medicationReminders: boolean;
  healthTips: boolean;
  systemNotifications: boolean;
  quietHours: {
    enabled: boolean;
    start: string; // HH:mm format
    end: string;   // HH:mm format
  };
}

class NotificationService {
  private notifications: HealthNotification[] = [];
  private settings: NotificationSettings;
  private listeners: ((notifications: HealthNotification[]) => void)[] = [];

  constructor() {
    this.settings = this.loadSettings();
    this.loadNotifications();
    this.setupPeriodicChecks();
  }

  // 설정 로드
  private loadSettings(): NotificationSettings {
    const saved = localStorage.getItem('welno_notification_settings');
    if (saved) {
      return JSON.parse(saved);
    }
    
    return {
      checkupReminders: true,
      abnormalValueAlerts: true,
      medicationReminders: true,
      healthTips: true,
      systemNotifications: true,
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00'
      }
    };
  }

  // 설정 저장
  private saveSettings(): void {
    localStorage.setItem('welno_notification_settings', JSON.stringify(this.settings));
  }

  // 알림 로드
  private loadNotifications(): void {
    const saved = localStorage.getItem('welno_notifications');
    if (saved) {
      this.notifications = JSON.parse(saved).map((n: any) => ({
        ...n,
        createdAt: new Date(n.createdAt),
        readAt: n.readAt ? new Date(n.readAt) : undefined
      }));
    }
  }

  // 알림 저장
  private saveNotifications(): void {
    localStorage.setItem('welno_notifications', JSON.stringify(this.notifications));
    this.notifyListeners();
  }

  // 리스너 등록
  public subscribe(listener: (notifications: HealthNotification[]) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // 리스너 알림
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.notifications));
  }

  // 알림 생성
  public createNotification(notification: Omit<HealthNotification, 'id' | 'createdAt'>): string {
    const id = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newNotification: HealthNotification = {
      id,
      createdAt: new Date(),
      ...notification
    };

    // 설정 확인
    if (!this.isNotificationEnabled(notification.type)) {
      return id;
    }

    // 조용한 시간 확인
    if (this.isQuietHours() && notification.priority !== 'urgent') {
      return id;
    }

    this.notifications.unshift(newNotification);
    this.saveNotifications();

    // 브라우저 알림 표시 (권한이 있는 경우)
    this.showBrowserNotification(newNotification);

    return id;
  }

  // 브라우저 알림 표시
  private showBrowserNotification(notification: HealthNotification): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      const browserNotification = new Notification(notification.title, {
        body: notification.message,
        icon: '/welno/welno_logo.png',
        badge: '/welno/welno_logo.png',
        tag: notification.id,
        requireInteraction: notification.priority === 'urgent',
        silent: notification.priority === 'low'
      });

      browserNotification.onclick = () => {
        if (notification.actionUrl) {
          window.location.href = notification.actionUrl;
        }
        browserNotification.close();
      };

      // 자동 닫기 (긴급하지 않은 경우)
      if (notification.priority !== 'urgent') {
        setTimeout(() => {
          browserNotification.close();
        }, 5000);
      }
    }
  }

  // 알림 타입별 활성화 확인
  private isNotificationEnabled(type: HealthNotification['type']): boolean {
    switch (type) {
      case 'checkup_reminder':
        return this.settings.checkupReminders;
      case 'abnormal_value':
        return this.settings.abnormalValueAlerts;
      case 'medication_reminder':
        return this.settings.medicationReminders;
      case 'health_tip':
        return this.settings.healthTips;
      case 'system':
        return this.settings.systemNotifications;
      default:
        return true;
    }
  }

  // 조용한 시간 확인
  private isQuietHours(): boolean {
    if (!this.settings.quietHours.enabled) return false;

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const start = this.settings.quietHours.start;
    const end = this.settings.quietHours.end;

    // 같은 날인 경우
    if (start < end) {
      return currentTime >= start && currentTime <= end;
    }
    // 다음 날로 넘어가는 경우 (예: 22:00 ~ 08:00)
    else {
      return currentTime >= start || currentTime <= end;
    }
  }

  // 알림 읽음 처리
  public markAsRead(notificationId: string): void {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification && !notification.readAt) {
      notification.readAt = new Date();
      this.saveNotifications();
    }
  }

  // 모든 알림 읽음 처리
  public markAllAsRead(): void {
    const now = new Date();
    this.notifications.forEach(n => {
      if (!n.readAt) {
        n.readAt = now;
      }
    });
    this.saveNotifications();
  }

  // 알림 삭제
  public deleteNotification(notificationId: string): void {
    this.notifications = this.notifications.filter(n => n.id !== notificationId);
    this.saveNotifications();
  }

  // 모든 알림 삭제
  public clearAllNotifications(): void {
    this.notifications = [];
    this.saveNotifications();
  }

  // 알림 목록 조회
  public getNotifications(): HealthNotification[] {
    return [...this.notifications];
  }

  // 읽지 않은 알림 수
  public getUnreadCount(): number {
    return this.notifications.filter(n => !n.readAt).length;
  }

  // 설정 조회
  public getSettings(): NotificationSettings {
    return { ...this.settings };
  }

  // 설정 업데이트
  public updateSettings(newSettings: Partial<NotificationSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
  }

  // 브라우저 알림 권한 요청
  public async requestPermission(): Promise<NotificationPermission> {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission;
    }
    return 'denied';
  }

  // 주기적 체크 설정
  private setupPeriodicChecks(): void {
    // 매일 오전 9시에 건강 팁 알림
    this.scheduleHealthTips();
    
    // 매주 월요일 오전 10시에 검진 리마인더 체크
    this.scheduleCheckupReminders();
    
    // 이상 수치 체크 (데이터 업데이트 시)
    this.setupAbnormalValueCheck();
  }

  // 건강 팁 스케줄링
  private scheduleHealthTips(): void {
    const healthTips = [
      {
        title: "수분 섭취 알림",
        message: "하루 8잔 이상의 물을 마시는 것이 건강에 좋습니다.",
      },
      {
        title: "운동 권장",
        message: "주 3회 이상, 30분씩 유산소 운동을 해보세요.",
      },
      {
        title: "금연 권장",
        message: "금연은 심혈관 질환 위험을 크게 줄여줍니다.",
      },
      {
        title: "정기 검진",
        message: "연 1회 이상 정기 건강검진을 받으시기 바랍니다.",
      }
    ];

    // 매일 오전 9시에 랜덤 건강 팁
    const scheduleDaily = () => {
      const now = new Date();
      const target = new Date(now);
      target.setHours(9, 0, 0, 0);
      
      if (target <= now) {
        target.setDate(target.getDate() + 1);
      }

      const timeout = target.getTime() - now.getTime();
      
      setTimeout(() => {
        const randomTip = healthTips[Math.floor(Math.random() * healthTips.length)];
        this.createNotification({
          type: 'health_tip',
          title: randomTip.title,
          message: randomTip.message,
          priority: 'low'
        });
        
        scheduleDaily(); // 다음 날 스케줄링
      }, timeout);
    };

    scheduleDaily();
  }

  // 검진 리마인더 스케줄링
  private scheduleCheckupReminders(): void {
    const scheduleWeekly = () => {
      const now = new Date();
      const target = new Date(now);
      
      // 다음 월요일 오전 10시
      const daysUntilMonday = (1 + 7 - now.getDay()) % 7 || 7;
      target.setDate(now.getDate() + daysUntilMonday);
      target.setHours(10, 0, 0, 0);

      const timeout = target.getTime() - now.getTime();
      
      setTimeout(() => {
        this.checkForCheckupReminders();
        scheduleWeekly(); // 다음 주 스케줄링
      }, timeout);
    };

    scheduleWeekly();
  }

  // 검진 리마인더 체크
  private checkForCheckupReminders(): void {
    const healthData = localStorage.getItem('welno_health_data');
    if (!healthData) return;

    try {
      const data = JSON.parse(healthData);
      const lastCheckup = data.health_data?.ResultList?.[0];
      
      if (lastCheckup) {
        const lastDate = new Date(`${lastCheckup.Year.replace('년', '')}-${lastCheckup.CheckUpDate.replace('/', '-')}`);
        const daysSinceLastCheckup = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysSinceLastCheckup > 365) {
          this.createNotification({
            type: 'checkup_reminder',
            title: "정기 건강검진 알림",
            message: `마지막 검진 후 ${Math.floor(daysSinceLastCheckup / 365)}년이 지났습니다. 정기 검진을 받아보세요.`,
            priority: 'medium',
            actionUrl: '/welno/login',
            actionLabel: '검진 예약하기'
          });
        }
      }
    } catch (error) {
      console.error('검진 리마인더 체크 실패:', error);
    }
  }

  // 이상 수치 체크 설정
  private setupAbnormalValueCheck(): void {
    // localStorage 변경 감지
    window.addEventListener('storage', (e) => {
      if (e.key === 'welno_health_data') {
        this.checkForAbnormalValues();
      }
    });
  }

  // 이상 수치 체크
  private checkForAbnormalValues(): void {
    const healthData = localStorage.getItem('welno_health_data');
    if (!healthData) return;

    try {
      const data = JSON.parse(healthData);
      const checkups = data.health_data?.ResultList || [];
      
      checkups.forEach((checkup: any) => {
        if (checkup.Code && (checkup.Code === '질환' || checkup.Code === '이상')) {
          this.createNotification({
            type: 'abnormal_value',
            title: "이상 수치 발견",
            message: `${checkup.Year} ${checkup.CheckUpDate} 검진에서 이상 수치가 발견되었습니다. 의료진과 상담하세요.`,
            priority: 'high',
            actionUrl: '/welno/dashboard',
            actionLabel: '상세 보기',
            data: { checkup }
          });
        }
      });
    } catch (error) {
      console.error('이상 수치 체크 실패:', error);
    }
  }

  // 약물 복용 리마인더 (처방전 데이터 기반)
  public createMedicationReminder(medicationName: string, dosage: string, time: string): void {
    this.createNotification({
      type: 'medication_reminder',
      title: "복용 시간 알림",
      message: `${medicationName} ${dosage} 복용 시간입니다.`,
      priority: 'medium',
      actionUrl: '/welno/prescriptions',
      actionLabel: '처방전 보기'
    });
  }

  // 시스템 알림
  public createSystemNotification(title: string, message: string, priority: HealthNotification['priority'] = 'low'): void {
    this.createNotification({
      type: 'system',
      title,
      message,
      priority
    });
  }
}

// 싱글톤 인스턴스
export const notificationService = new NotificationService();
export default notificationService;
