# Decisiones de FRAGUAN pendientes

Actualizado: 6 de octubre de 2026.

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
   Faltan cuentas, credenciales API, código postal de origen y embalaje con peso y
   medidas. Ver `docs/envios-correo-andreani.md`.
4. **Pagos online:** conectar los proveedores elegidos para cobrar y confirmar
   pagos reales, registrar comisiones y estados y conciliar cada cobro con su pedido.
5. **Resend:** conectar el servicio y dominio remitente para enviar los correos
   reales de FRAGUAN.
6. **CyberMonday:** precios promocionales temporales por producto/variante, precio
   anterior tachado, conservación de los precios previos y un botón para restaurarlos.
   Guardar quién cambió los precios y cuándo. El dueño mencionó subir precios antes
   de aplicar descuentos; se recomienda usar el precio anterior real como referencia,
   sin inflarlo para aparentar una rebaja. Esta mecánica queda para confirmar.
7. **SEO:** revisar la presencia orgánica de la tienda, indexación, títulos,
   descripciones, enlaces y páginas de productos/categorías.
8. **Seguimiento automático de envíos:** obtener el tracking y estado del proveedor,
   asociarlos al pedido y permitir verlos desde la página del pedido/envío en la tienda.
9. **Email de compra:** confirmar al cliente el pedido, sus productos, importes y
   siguientes pasos. Diferenciar pedido recibido de pago efectivamente acreditado.
10. **Email de bienvenida:** enviar al crear la cuenta de la tienda; no prometer
    beneficios del Club mientras no se hayan definido.
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
bienvenida y marketing desde hola@fraguan.com. Remitentes preparados en Railway
y separación implementada en código. API key y destinatario para prueba real
pendientes de cargar/confirmar por el dueño. Detalles en docs/resend.md.
