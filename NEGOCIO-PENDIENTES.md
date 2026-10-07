# Decisiones de FRAGUAN pendientes

Actualizado: 7 de octubre de 2026.

## Club FRAGUAN

El programa todavía no está definido ni lanzado. Crear una cuenta de tienda no
equivale a dar de alta un socio ni garantiza beneficios.

Falta definir las condiciones para recibir beneficios (por ejemplo, compras,
importe acumulado o frecuencia), qué se ofrecerá, vigencia, restricciones,
acumulación y cómo se administrará. Son decisiones pendientes, no reglas aprobadas.

La cuenta debe mostrar los beneficios reales configurados. Cuando no haya,
mostrar: «Todavía no tenemos beneficios disponibles para vos».

## Descuento

Por indicación del dueño, se mantiene el anuncio y el descuento actual del 10%
por transferencia en la tienda y el checkout. No se cambia ni se pausa ahora.

Queda pendiente revisar y decidir el porcentaje definitivo, las condiciones y
la vigencia. Cuando se cambie, actualizar de forma coherente el cálculo del
servidor, el checkout, los anuncios y la información de pagos. Este descuento
no define los beneficios del futuro Club FRAGUAN.

## Listado general para confirmar con el dueño

Estos puntos registran objetivos pendientes. No son integraciones activadas ni
reglas aprobadas para implementar sin definir sus datos y condiciones.

1. **Empresa en Google:** se interpreta como crear o completar el Perfil de Empresa
   de FRAGUAN en Google y Maps, con el local, contacto, horarios y enlace a la tienda.
   Confirmar que el dueño se refiere a esta ficha.
2. **Meta Ads:** conectar la publicidad y la medición de resultados de las campañas
   con la tienda. Definir cuentas, eventos y campañas antes de activarlas.
3. **Métodos de envío:** Correo Argentino y Andreani a domicilio desde Isla Verde.
   Pospuestos por el dueño el 07/10/2026: informó que el acceso de Andreani no
   funciona y pidió retomar las integraciones más adelante.
   Faltan cuentas, credenciales API, código postal de origen y embalaje con peso y
   medidas. Ver `docs/envios-correo-andreani.md`.
4. **Pagos online:** conectar los proveedores elegidos para cobrar y confirmar
   pagos reales, registrar comisiones y estados y conciliar cada cobro con su pedido.
5. **Resend — conectado:** dominio y remitentes configurados; dueño confirmó
   recepción de pruebas. Pendiente definir marketing y automatizaciones adicionales.
6. **CyberMonday:** precios promocionales temporales por producto/variante, precio
   anterior tachado, conservación de los precios previos y un botón para restaurarlos.
   Guardar quién cambió los precios y cuándo. El dueño mencionó subir precios antes
   de aplicar descuentos; se recomienda usar el precio anterior real como referencia,
   sin inflarlo para aparentar una rebaja. Esta mecánica queda para confirmar.
7. **SEO:** revisar la presencia orgánica de la tienda, indexación, títulos,
   descripciones, enlaces y páginas de productos/categorías.
8. **Seguimiento automático de envíos:** obtener el tracking y estado del proveedor,
   asociarlos al pedido y permitir verlos desde la página del pedido/envío en la tienda.
9. **Email de compra — implementado:** pedido y productos, importes y siguientes
   pasos. Distingue pedido recibido de pago confirmado y avisa sus estados.
10. **Email de bienvenida — implementado:** al crear la cuenta de la tienda;
    no promete beneficios del Club mientras no se hayan definido.
11. **Promociones:** definir y administrar las ofertas reales, condiciones, vigencia
    y combinación de descuentos. Si se refiere también a emails promocionales,
    confirmar las campañas deseadas.
12. **Crecimiento online:** generar enlaces de campaña identificables (UTM) y mostrar
    de dónde llegan las visitas, qué campañas generan pedidos y su resultado.
13. **Recuperación de compras abandonadas:** registrar en qué etapa se interrumpe
    la compra y gestionar los emails para recuperar al cliente desde un área visible.
    Definir los tiempos, mensajes y condiciones de envío.
14. **Club FRAGUAN:** decidir su funcionamiento, requisitos para acceder a beneficios,
    beneficios concretos, niveles si corresponde, vigencia y canjes. Todavía no está lanzado.
15. **Facturas recibidas:** cargar comprobantes de proveedores/gastos, guardar el
    documento y asociar sus datos a la compra o gasto y a la imputación correcta.
    Definir las categorías y tratamiento contable con los datos reales del negocio.
16. **Bancos y destino de cobros:** confirmado el 07/10/2026: débito, crédito y
    prepaga por el posnet de Mercado Pago; transferencias a Mercado Pago; efectivo
    en Caja. Cuatro métodos principales en POS: Débito, Crédito, Efectivo y
    Transferencia. Prepaga como tipo de tarjeta dentro de Débito, con su comisión
    y plazo propios. Sin cuotas habilitadas por ahora. Destino editable en
    Administración y conservado en cada nuevo cobro. Falta conectar/reconciliar
    saldos reales de las cuentas: registrar el destino no confirma acreditación.
    Comisiones sin IVA ni retenciones: débito 2,88%/2 días; crédito 4,40%/10 días;
    prepaga 3,68%/3 días. Por decisión del dueño (07/10/2026), se retira
    el registro de IVA del alcance; no sumar IVA automáticamente ni presentar
    estas comisiones como costo final con impuestos incluidos.

## Ya implementado: productos y etiquetas

Autocompletado basado en valores reales de prendas activas. Después del alta de
un producto o variante, confirmación de guardado y vista previa para imprimir
etiquetas con los códigos y precios de esa variante. Nictom IT02: papel de 58 mm,
área impresa de 48 mm. El dueño confirmó etiquetas listas el 07/10/2026.


## Decisiones del 07/10/2026

Caja diaria: el dueño da por suficiente la implementación existente.
Acreditaciones: el dueño confirmó usar automáticamente el día previsto según
el plazo guardado al cobrar, sin confirmación manual de tarjetas. Transferencia
del local ingresada al confirmar la venta. Solo transferencias de compras online
requieren confirmar el pago en Pedidos online. Vista en Admin → Bancos.


## Resend — preparación del 07/10/2026

Dominio fraguan.com verificado en Resend. Pedidos desde pedidos@fraguan.com;
bienvenida y marketing desde hola@fraguan.com. Clave y remitentes configurados
en Railway y Vercel. El dueño confirmó recepción de pruebas en hola@fraguan.com.
Plantilla con la identidad de la tienda aplicada a los emails existentes.
Bienvenida y avisos de pedido recibido, pago confirmado, preparación, retiro,
despacho y entrega diseñados con datos reales de la compra. Seguimiento enlaza
Correo Argentino solo si hay código y corresponde a ese envío.
Pendiente marketing y Club FRAGUAN, definidos según prendas y números reales;
definir también porcentajes de transferencia, cupones y umbral de envío gratis.
Esta tarea no cambia las reglas comerciales que ya están activas.
Pendiente seguimiento automático, Andreani, recuperación de compras y campañas.
No activar campañas sin definirlas.
Detalles en docs/resend.md.

## Revisión y cupos de emails — 07/10/2026

Límites informados: 3.000 emails/mes y 1.000 contactos Marketing gratuitos.
Resend también aplica 100 emails/día. Con la API actual, bienvenida y recuperación
consumen el mismo cupo de envíos que pedidos. Priorizar compras/verificación.
Recuperación autorizada: dos avisos a 2 y 24 horas, sin descuentos; pausa,
horarios y presupuesto desde Crecimiento online. Inicial: 30 recordatorios/día,
900/mes; posponer a 80 envíos/día o 2.400/mes registrados para dejar margen.
Conteos locales orientativos; contrastar con Resend. Si volumen requiere pago,
el dueño acepta evaluarlo; no contratar automáticamente.
CyberMonday reversible no implementado. Priorizar stock compartido POS/reservas
online y número de pedido concurrente. SEO/Search Console y decisiones pendientes
detallados en REVISION_SISTEMA.md. Mantener Meta Ads y Google Maps para después.
