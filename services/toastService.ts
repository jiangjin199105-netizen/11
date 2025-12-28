
type ToastType = 'success' | 'error' | 'info';

class ToastService {
  private listeners: ((msg: string, type: ToastType) => void)[] = [];

  subscribe(listener: (msg: string, type: ToastType) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  show(msg: string, type: ToastType = 'success') {
    this.listeners.forEach(l => l(msg, type));
  }

  success(msg: string) {
    this.show(msg, 'success');
  }

  error(msg: string) {
    this.show(msg, 'error');
  }
  
  info(msg: string) {
    this.show(msg, 'info');
  }
}

export const toast = new ToastService();
