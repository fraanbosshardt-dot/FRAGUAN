'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/client';

export function AdminSeoControls() {
  const [path, setPath] = useState('/');
  const [loaded, setLoaded] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [verification, setVerification] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [exclude, setExclude] = useState(false);
  useEffect(
    () =>
      setExclude(localStorage.getItem('fraguan-exclude-analytics') === 'yes'),
    [],
  );
  const load = async () => {
    setBusy(true);
    setNotice('');
    setLoaded('');
    try {
      const data = await api('seo?path=' + encodeURIComponent(path));
      setTitle(data.title);
      setDescription(data.description);
      setVerification(data.verification);
      setLoaded(data.path);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'No pudimos cargar el SEO.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="panel">
      <label>
        <input
          type="checkbox"
          checked={exclude}
          onChange={(e) => {
            setExclude(e.target.checked);
            localStorage.setItem(
              'fraguan-exclude-analytics',
              e.target.checked ? 'yes' : 'no',
            );
          }}
        />{' '}
        Excluir mis visitas de prueba en este navegador
      </label>
      <p>
        Evita registrar nuevas visitas y acciones de navegación. No borra datos
        anteriores ni excluye pedidos o cobros reales.
      </p>
      <div className="panel-heading">
        <h2>SEO y Search Console</h2>
        <span>Google</span>
      </div>
      <p>
        Elegí la página y cargá su configuración. Si dejás los textos vacíos, se
        usan el nombre y la descripción actuales de la tienda.
      </p>
      <div className="admin-growth-form">
        <label>
          Ruta de la página
          <input
            value={path}
            onChange={(e) => {
              setPath(e.target.value);
              setLoaded('');
              setNotice('');
            }}
            placeholder="/producto/nombre-de-la-prenda"
          />
        </label>
        <small>
          Home: /. Categoría: /coleccion/remeras. Producto: copiá la ruta de su
          enlace público.
        </small>
        <button type="button" className="button" disabled={busy} onClick={load}>
          {busy ? 'Cargando…' : 'Cargar configuración'}
        </button>
      </div>
      {loaded === path && (
        <form
          className="admin-growth-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setNotice('');
            try {
              await api('seo', { path, title, description, verification });
              setNotice(
                'SEO guardado. Google actualizará sus resultados cuando vuelva a rastrear la página.',
              );
            } catch (error) {
              setNotice(
                error instanceof Error ? error.message : 'No pudimos guardar.',
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Título SEO
            <input
              value={title}
              maxLength={70}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <small>{title.length}/70 caracteres</small>
          <label>
            Descripción SEO
            <textarea
              value={description}
              maxLength={180}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <small>{description.length}/180 caracteres</small>
          {path === '/' && (
            <label>
              Código de verificación de Google (opcional)
              <input
                value={verification}
                onChange={(e) => setVerification(e.target.value)}
                maxLength={200}
                pattern="[a-zA-Z0-9_-]*"
              />
              <small>
                Solo el valor content de la etiqueta, sin pegar HTML. Una
                propiedad de dominio se verifica por DNS.
              </small>
            </label>
          )}
          <div>
            <strong>{title || 'Título automático de la página'}</strong>
            <p>www.fraguan.com{path === '/' ? '' : path}</p>
            <p>{description || 'Descripción automática de la página'}</p>
          </div>
          <button className="button" disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar SEO'}
          </button>
        </form>
      )}
      <output aria-live="polite">{notice}</output>
      <p>
        <a
          href="https://search.google.com/search-console"
          target="_blank"
          rel="noopener noreferrer"
        >
          Abrir Search Console →
        </a>{' '}
        ·{' '}
        <a
          href="https://www.fraguan.com/sitemap.xml"
          target="_blank"
          rel="noopener noreferrer"
        >
          Ver sitemap →
        </a>
      </p>
      <p>
        Revisá indexación, consultas y rendimiento en Search Console. Los
        pedidos de indexación y los informes de Google se gestionan allí; no
        están sincronizados con Admin.
      </p>
    </section>
  );
}
