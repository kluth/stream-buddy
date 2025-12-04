import { Component, OnInit, OnDestroy, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  OverlayElement,
  TextOverlayElement,
  ImageOverlayElement,
  VideoOverlayElement,
  WebOverlayElement,
  ChatOverlayElement,
  AlertOverlayElement,
  OverlayElementType,
} from '@broadboi/core/models';
import { OverlayRendererService } from '@broadboi/core/services'; // Import the OverlayRendererService
import { Subject, takeUntil } from 'rxjs';
import { CdkDragEnd, DragDropModule } from '@angular/cdk/drag-drop'; // Import DragDropModule and CdkDragEnd
import { ResizableModule, ResizeEvent } from 'angular-resizable-element'; // Import ResizableModule and ResizeEvent

@Component({
  selector: 'app-overlay-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, ResizableModule], // Add DragDropModule and ResizableModule here
  templateUrl: './overlay-editor.html',
  styleUrl: './overlay-editor.scss',
})
export class OverlayEditorComponent implements OnInit, OnDestroy {
  overlayElements: OverlayElement[] = [];
  selectedElement: OverlayElement | null = null;

  newTextContent = 'New Text';
  newImageUrl = 'https://via.placeholder.com/150';
  newVideoUrl = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
  newWebUrl = 'https://example.com';

  private readonly overlayRendererService = inject(OverlayRendererService);
  private readonly destroy$ = new Subject<void>();

  private rotatingElement: OverlayElement | null = null;
  private startAngle = 0;
  private center = { x: 0, y: 0 };

  // Placeholder for internal user ID. In a real app, this would come from an auth service.
  get internalUserId(): string {
    return 'user123'; // Hardcoded for now
  }

  ngOnInit(): void {
    console.log('OverlayEditorComponent initialized');
    this.overlayRendererService.loadOverlayConfig(this.internalUserId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(config => {
        this.overlayElements = config;
        // Select the first element if any, or add a default
        if (this.overlayElements.length === 0) {
          this.addElement('text');
        } else {
          this.selectedElement = this.overlayElements[0];
        }
      });

    this.overlayRendererService.connectWebSocket(this.internalUserId);
  }

  ngOnDestroy(): void {
    this.overlayRendererService.disconnectWebSocket();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private generateUniqueId(prefix: string = 'element'): string {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  addElement(type: OverlayElementType): void {
    const baseProps = {
      id: this.generateUniqueId(type),
      x: 50,
      y: 50,
      width: 100,
      height: 50,
      rotation: 0,
      opacity: 1,
      zIndex: this.overlayElements.length + 1,
      locked: false,
      visible: true,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${this.overlayElements.filter(e => e.type === type).length + 1}`,
    };

    let newElement: OverlayElement;

    switch (type) {
      case 'text':
        newElement = {
          ...baseProps,
          type: 'text',
          text: this.newTextContent,
          fontFamily: 'Arial',
          fontSize: 24,
          fill: '#ffffff',
          textAlign: 'left',
          fontWeight: 'normal',
          fontStyle: 'normal',
          textDecoration: 'none',
          height: 30,
        } as TextOverlayElement;
        break;
      case 'image':
        newElement = {
          ...baseProps,
          type: 'image',
          src: this.newImageUrl,
          width: 150,
          height: 150,
        } as ImageOverlayElement;
        break;
      case 'video':
        newElement = {
          ...baseProps,
          type: 'video',
          src: this.newVideoUrl,
          loop: true,
          autoplay: true,
          muted: true,
          width: 320,
          height: 180,
        } as VideoOverlayElement;
        break;
      case 'web':
        newElement = {
          ...baseProps,
          type: 'web',
          url: this.newWebUrl,
          width: 640,
          height: 360,
        } as WebOverlayElement;
        break;
      case 'chat':
        newElement = {
          ...baseProps,
          type: 'chat',
          width: 300,
          height: 400,
          maxMessages: 50,
          fontSize: 16,
          textColor: '#ffffff',
          backgroundColor: 'rgba(0,0,0,0.5)',
        } as ChatOverlayElement;
        break;
      case 'alert':
        newElement = {
          ...baseProps,
          type: 'alert',
          width: 400,
          height: 150,
          defaultImage: 'https://via.placeholder.com/100x100?text=Alert',
          defaultSound: '/assets/alert.mp3',
          duration: 5000,
          animation: 'fade-in-out',
          template: '{username} just followed!',
        } as AlertOverlayElement;
        break;
      default:
        return;
    }
    this.overlayElements.push(newElement);
    this.overlayElements.sort((a, b) => a.zIndex - b.zIndex); // Re-sort after adding
    this.selectedElement = newElement; // Select the newly added element
  }

  selectElement(element: OverlayElement): void {
    this.selectedElement = element;
    console.log('Selected element:', element);
  }

  updateSelectedElementProperty(property: string, value: any): void {
    if (this.selectedElement) {
      // Create a new object to trigger change detection if needed
      this.selectedElement = { ...this.selectedElement, [property]: value };
      const index = this.overlayElements.findIndex(el => el.id === this.selectedElement?.id);
      if (index > -1) {
        this.overlayElements[index] = this.selectedElement;
        // Re-sort if zIndex changed
        if (property === 'zIndex') {
          this.overlayElements.sort((a, b) => a.zIndex - b.zIndex);
        }
      }
    }
  }

  onDragEnded(event: CdkDragEnd, element: OverlayElement): void {
    if (this.selectedElement && this.selectedElement.id === element.id) {
      const { x, y } = event.source.getFreeDragPosition();
      this.selectedElement.x = x;
      this.selectedElement.y = y;
      this.updateSelectedElementProperty('x', x);
      this.updateSelectedElementProperty('y', y);
    }
  }

  onResizeEnd(event: ResizeEvent, element: OverlayElement): void {
    if (this.selectedElement && this.selectedElement.id === element.id) {
      this.selectedElement.width = event.rectangle.width || this.selectedElement.width;
      this.selectedElement.height = event.rectangle.height || this.selectedElement.height;
      this.selectedElement.x = event.rectangle.left || this.selectedElement.x;
      this.selectedElement.y = event.rectangle.top || this.selectedElement.y;
      this.updateSelectedElementProperty('width', this.selectedElement.width);
      this.updateSelectedElementProperty('height', this.selectedElement.height);
      this.updateSelectedElementProperty('x', this.selectedElement.x);
      this.updateSelectedElementProperty('y', this.selectedElement.y);
    }
  }

  onRotationStart(event: MouseEvent, element: OverlayElement): void {
    if (element.locked) {
      return;
    }
    this.rotatingElement = element;
    event.preventDefault();
    event.stopPropagation();

    const target = event.currentTarget as HTMLElement;
    const elementRect = target.parentElement!.getBoundingClientRect();
    this.center = {
      x: elementRect.left + elementRect.width / 2,
      y: elementRect.top + elementRect.height / 2,
    };

    const dx = event.clientX - this.center.x;
    const dy = event.clientY - this.center.y;
    this.startAngle = Math.atan2(dy, dx) * (180 / Math.PI) - element.rotation;
  }

  @HostListener('document:mousemove', ['$event'])
  onRotationMove(event: MouseEvent): void {
    if (this.rotatingElement && !this.rotatingElement.locked) {
      const dx = event.clientX - this.center.x;
      const dy = event.clientY - this.center.y;
      const newAngle = Math.atan2(dy, dx) * (180 / Math.PI);
      const rotation = newAngle - this.startAngle;
      this.updateSelectedElementProperty('rotation', rotation);
    }
  }

  @HostListener('document:mouseup', ['$event'])
  onRotationEnd(event: MouseEvent): void {
    this.rotatingElement = null;
  }

  saveOverlay(): void {
    this.overlayRendererService.saveOverlayConfig(this.internalUserId, this.overlayElements)
      .subscribe({
        next: (response) => console.log('Overlay saved successfully:', response),
        error: (error) => console.error('Failed to save overlay:', error),
      });
  }

  // Helper methods for the template
  isTextElement(element: OverlayElement): element is TextOverlayElement { return element.type === 'text'; }
  isImageElement(element: OverlayElement): element is ImageOverlayElement { return element.type === 'image'; }
  isVideoElement(element: OverlayElement): element is VideoOverlayElement { return element.type === 'video'; }
  isWebElement(element: OverlayElement): element is WebOverlayElement { return element.type === 'web'; }
  isChatElement(element: OverlayElement): element is ChatOverlayElement { return element.type === 'chat'; }
  isAlertElement(element: OverlayElement): element is AlertOverlayElement { return element.type === 'alert'; }
}
