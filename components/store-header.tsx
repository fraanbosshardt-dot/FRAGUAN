'use client';
import {
  Menu,
  Search,
  ShoppingBag,
  UserRound,
  X,
  ArrowRight,
  Minus,
  Plus,
} from 'lucide-react';
import { useState } from 'react';
import { useStoreCart, storeMoney } from '@/lib/store-client';
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
  const [menu, setMenu] = useState(false);
  return (
    <>
      <div className="store-promo">
        10% OFF POR TRANSFERENCIA <span>·</span> ENVÍOS A TODO EL PAÍS
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
          FRAGUAN
        </a>
        <nav aria-label="Tienda">
          <a href="/?section=Nuevos">Nuevos</a>
          <a href="/?section=Camisas">Camisas</a>
          <a href="/?section=Remeras">Remeras</a>
          <a href="/?section=Pantalones">Pantalones</a>
          <a href="/?section=Camperas">Abrigos</a>
        </nav>
        <div className="store-header-actions">
          <a href="/?search=1" aria-label="Buscar">
            <Search />
          </a>
          <a href="/cuenta" aria-label="Mi cuenta">
            <UserRound />
          </a>
          <Sheet>
            <SheetTrigger
              className="store-cart-trigger"
              aria-label={`Carrito, ${count} productos`}
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
                        onClick={() => update(item.id, item.quantity - 1)}
                        aria-label="Quitar una unidad"
                      >
                        <Minus />
                      </button>
                      <span>{item.quantity}</span>
                      <button
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
                <span>Subtotal</span>
                <strong>{storeMoney(subtotal)}</strong>
                <small>
                  Con transferencia pagás{' '}
                  {storeMoney(Math.floor(subtotal * 0.9))}
                </small>
                <a
                  className={cart.length ? '' : 'disabled'}
                  href={cart.length ? '/checkout' : '#'}
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
            <a href="/?section=Nuevos">Nuevos ingresos</a>
            <a href="/?section=Camisas">Camisas</a>
            <a href="/?section=Remeras">Remeras</a>
            <a href="/?section=Pantalones">Pantalones</a>
            <a href="/?section=Camperas">Abrigos</a>
            <a href="/cuenta">Mi cuenta / Club</a>
          </nav>
        </div>
      )}
    </>
  );
}
