import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class WebRTCGatewayService {
  private _isConnected = new BehaviorSubject<boolean>(false);
  public isConnected = this._isConnected.asObservable();

  async connect(stream: MediaStream, streamPath: string): Promise<void> {
    console.log('Mock WebRTC connect', streamPath);
    this._isConnected.next(true);
  }

  async disconnect(): Promise<void> {
    console.log('Mock WebRTC disconnect');
    this._isConnected.next(false);
  }
}
