import { Injectable, signal, computed } from '@angular/core';

/**
 * Merch & Affiliate Service
 *
 * Integrates with e-commerce and affiliate platforms to display products on stream.
 *
 * Features:
 * - Product Management (Name, Image, Price, Link)
 * - Affiliate Link Tracking
 * - "Featured Product" Overlay
 * - Automatic Rotation
 *
 * Issue: #286
 */

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  imageUrl: string;
  purchaseUrl: string;
  type: 'merch' | 'affiliate' | 'sponsor';
  inStock: boolean;
}

export interface PromoCode {
  code: string;
  discount: string; // "10%" or "$5"
  description: string;
}

@Injectable({
  providedIn: 'root'
})
export class MerchService {
  // State
  readonly products = signal<Product[]>([]);
  readonly activeProduct = signal<Product | null>(null);
  readonly promoCodes = signal<PromoCode[]>([]);

  constructor() {
    this.loadMockProducts();
  }

  addProduct(product: Omit<Product, 'id'>) {
    const newProduct: Product = {
      ...product,
      id: crypto.randomUUID()
    };
    this.products.update(p => [...p, newProduct]);
  }

  setActiveProduct(productId: string | null) {
    if (!productId) {
      this.activeProduct.set(null);
      return;
    }
    const product = this.products().find(p => p.id === productId);
    if (product) {
      this.activeProduct.set(product);
    }
  }

  private loadMockProducts() {
    this.addProduct({
      name: 'Official BroadBoi Hoodie',
      description: 'Premium quality hoodie with embroidered logo.',
      price: 49.99,
      currency: 'USD',
      imageUrl: 'assets/mock-hoodie.png',
      purchaseUrl: 'https://store.broadboi.com/hoodie',
      type: 'merch',
      inStock: true
    });

    this.addProduct({
      name: 'Elgato Stream Deck',
      description: 'The essential tool for streamers.',
      price: 149.99,
      currency: 'USD',
      imageUrl: 'assets/mock-streamdeck.png',
      purchaseUrl: 'https://amzn.to/example',
      type: 'affiliate',
      inStock: true
    });
  }
}
