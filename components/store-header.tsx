'use client';
import {
  Menu,
  Search,
  ShoppingBag,
  UserRound,
  Heart,
  X,
  ArrowRight,
  Minus,
  Plus,
} from 'lucide-react';
import { useState } from 'react';
import Image from 'next/image';
import { useStoreCart, useStoreFavorites, storeMoney, trackStore } from '@/lib/store-client';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

export function StoreHeader({ dark = false }: { dark?: boolean }) {
  const { cart, count, subtotal, update } = useStoreCart();
  const { favorites } = useStoreFavorites();
  const [menu, setMenu] = useState(false);
  return (
    <>
      <div className="store-promo">
        <div className="store-promo-track" aria-label="Beneficios de compra">
          <span>10% OFF PAGANDO POR TRANSFERENCIA</span>
          <span>ENVÍOS A TODO EL PAÍS</span>
          <span aria-hidden="true">10% OFF PAGANDO POR TRANSFERENCIA</span>
          <span aria-hidden="true">ENVÍOS A TODO EL PAÍS</span>
        </div>
      </div>
      <header className={`store-header ${dark ? 'on-dark' : ''}`}>
        <button
          className="store-menu-button"
          onClick={() => setMenu(true)}
          aria-label="Abrir menú"
        >
          <Menu />
        </button>
        <a className="store-logo" href="/">
          <Image src="/fraguan-logo.jpg" alt="" width={38} height={38} />
          <span>FRAGUAN</span>
        </a>
        <nav aria-label="Tienda">
          <a href="/coleccion/nuevos">Nuevos</a>
          <a href="/coleccion/camisas">Camisas</a>
          <a href="/coleccion/remeras">Remeras</a>
          <a href="/coleccion/pantalones">Pantalones</a>
          <a href="/coleccion/camperas">Abrigos</a>
        </nav>
        <div className="store-header-actions">
          <a href="/?search=1" aria-label="Buscar">
            <Search />
          </a>
          <a href="/?favorites=1" aria-label={`${favorites.length} favoritos`}>
            <Heart />
            {!!favorites.length && <span className="store-favorite-count">{favorites.length}</span>}
          </a>
          <a href="/cuenta" aria-label="Mi cuenta">
            <UserRound />
          </a>
          <Sheet>
            <SheetTrigger
              className="store-cart-trigger"
              aria-label={`Carrito, ${count} productos`}
              onClick={() => trackStore('view_cart', { value: subtotal })}
            >
              <ShoppingBag />
              <span>{count}</span>
            </SheetTrigger>
            <SheetContent className="store-cart-sheet">
              <SheetHeader>
                <SheetTitle>Tu selección</SheetTitle>
                <SheetDescription>
                  {count
                    ? `${count} ${count === 1 ? 'prenda' : 'prendas'}`
                    : 'Todavía no agregaste productos.'}
                </SheetDescription>
              </SheetHeader>
              <div className="store-cart-lines">
                {cart.map((item) => (
                  <article key={item.id}>
                    <a href={`/producto/${item.slug}`}>{item.productName}</a>
                    <p>
                      {item.color} · Talle {item.size}
                    </p>
                    <div>
                      <button
                        type="button"
                        onClick={() => update(item.id, item.quantity - 1)}
                        aria-label="Quitar una unidad"
                      >
                        <Minus />
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => update(item.id, item.quantity + 1)}
                        aria-label="Agregar una unidad"
                      >
                        <Plus />
                      </button>
                      <strong>{storeMoney(item.price * item.quantity)}</strong>
                    </div>
                  </article>
                ))}
              </div>
              <div className="store-cart-total">
                {subtotal > 0 && (
                  <div className="store-shipping-progress">
                    <span>
                      {subtotal >= 18000000
                        ? 'Tenés envío gratis'
                        : `Te faltan ${storeMoney(18000000 - subtotal)} para envío gratis`}
                    </span>
                    <i><b style={{ width: `${Math.min(100, subtotal / 180000)}%` }} /></i>
                  </div>
                )}
                <span>Subtotal</span>
                <strong>{storeMoney(subtotal)}</strong>
                <small>
                  Con transferencia pagás{' '}
                  {storeMoney(Math.floor(subtotal * 0.9))}
                </small>
                <a
                  className={cart.length ? '' : 'disabled'}
                  href={cart.length ? '/checkout' : '#'}
                  onClick={() => cart.length && trackStore('begin_checkout', { value: subtotal })}
                >
                  Finalizar compra <ArrowRight />
                </a>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>
      {menu && (
        <div className="store-mobile-menu">
          <button onClick={() => setMenu(false)} aria-label="Cerrar menú">
            <X />
          </button>
          <a href="/">FRAGUAN</a>
          <nav>
            <a href="/coleccion/nuevos">Nuevos ingresos</a>
            <a href="/coleccion/camisas">Camisas</a>
            <a href="/coleccion/remeras">Remeras</a>
            <a href="/coleccion/pantalones">Pantalones</a>
            <a href="/coleccion/camperas">Abrigos</a>
            <a href="/?favorites=1">Favoritos</a>
            <a href="/cuenta">Mi cuenta / Club</a>
          </nav>
        </div>
      )}
    </>
  );
}
