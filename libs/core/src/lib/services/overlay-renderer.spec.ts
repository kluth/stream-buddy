import { TestBed } from '@angular/core/testing';

import { OverlayRenderer } from './overlay-renderer';

describe('OverlayRenderer', () => {
  let service: OverlayRenderer;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OverlayRenderer);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
