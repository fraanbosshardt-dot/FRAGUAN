# Envíos: Correo Argentino y Andreani

Actualizado: 7 de octubre de 2026.

## Estado: pospuesto por el dueño

El 07/10/2026 el dueño informó que el acceso de Andreani no funciona y pidió
dejar las integraciones de envíos para más adelante. No se continuará el alta,
la conexión API ni la activación de cotizaciones hasta que se retome el trabajo.
El fallo fue informado por el dueño; no se confirmó una caída general del servicio.
Siguen pendientes los accesos/contratos, la dirección y código postal de origen,
y el peso y dimensiones del embalaje. La configuración existente de la tienda
no se modificó durante este intento de integración.

## Decisiones confirmadas

- Origen: local 1 de FRAGUAN, Isla Verde, Córdoba, Argentina.
- Transportistas: Correo Argentino y Andreani.
- Modalidad solicitada: entrega a domicilio para ambos.
- Mostrar al comprador el costo de envío antes de confirmar la compra.
- Integrar también la gestión de envíos en Administración.
- FRAGUAN todavía no tiene cuentas comerciales ni acceso API de estos proveedores.

## Estado del proyecto

`lib/online-store.ts` contiene conexión a MiCorreo para autenticación, cotización
por código postal e importación de pedidos. No está validada con una cuenta real.
Cuando faltan credenciales, el código actual devuelve una tarifa estimada según
zona postal; esa tarifa no proviene de Correo Argentino.

El checkout actualmente permite Correo Argentino a domicilio y retiro en el local.
Todavía no ofrece Andreani. El peso y las dimensiones usados por la implementación
actual son supuestos del código, no medidas confirmadas del embalaje de FRAGUAN.

Administración permite registrar el tracking manualmente. La etiqueta, el tracking
automático y los eventos de entrega aún deben completarse y validarse por proveedor.

## Datos y altas necesarios

1. Crear la cuenta MiCorreo de FRAGUAN y solicitar credenciales API de prueba y
   producción a Correo Argentino. Obtener también el identificador de cliente.
2. Crear la cuenta de Andreani para FRAGUAN y solicitar acceso a Integraciones,
   credenciales de prueba/producción y el contrato de entrega a domicilio aplicable.
3. Confirmar código postal y dirección de origen, peso, dimensiones y reglas para
   armar paquetes de varias prendas. No usar valores inventados para tarifas reales.
4. Cargar las credenciales en Railway, sin guardarlas en Git ni en la documentación.

## Alcance de implementación pendiente

- Adaptadores independientes por transportista y respuestas de cotización unificadas.
- Checkout: destino, tarifas disponibles por proveedor y selección del comprador;
  mensajes claros si un proveedor no responde o no cubre el destino.
- Guardar proveedor, servicio, paquete, costo y vigencia de la cotización en el pedido.
- Recalcular el importe en el servidor al confirmar; no confiar en precios del navegador.
- Administración: crear el envío cuando corresponda, obtener etiquetas, registrar
  tracking y mostrar su estado. Evitar duplicados y auditar quién lo gestionó.
- Mantener separados el costo del transportista y el importe cobrado al cliente
  cuando FRAGUAN aplique una promoción de envío gratis.
- Probar con las credenciales de QA los destinos, errores, vencimientos, reintentos
  y pedidos con varias prendas antes de activar el servicio productivo.

## Documentación oficial consultada

- [API MiCorreo](https://www.correoargentino.com.ar/MiCorreo/public/img/pag/apiMiCorreo.pdf)
- [Servicios e integración de MiCorreo](https://www.correoargentino.com.ar/MiCorreo/public/paq-ar)
- [Andreani Developers](https://developers.andreani.com/document)
- [Integraciones Andreani](https://www.andreani.com/integraciones)

## Andreani — inicio de configuración, 07/10/2026

El dueño eligió integrar Andreani primero. Revisada la documentación oficial
desde el navegador, todavía sin configurar credenciales ni activar tarifas:

- Registro como usuario PyME en Andreani.com si aún no se es cliente. Acceso a
  credenciales/contrato desde Integraciones; confirmar con Andreani el acceso QA
  y producción para el servicio contratado.
- Autenticación: GET /login con Basic Auth (usuario/contraseña). Token de 24 horas;
  llamadas autenticadas con header x-authorization-token.
- Bases oficiales: https://apisqa.andreani.com y https://apis.andreani.com.
- Cotización: GET /v1/tarifas, con parámetros según el contrato. No asumir tarifa,
  moneda, unidades ni embalaje sin validar su mapeo y la cuenta real.
- Pre-envío: POST /v2/ordenes-de-envio. La respuesta incluye número de envío y
  enlaces de etiquetas; generar la orden no equivale a despacho físico.
- Validar estado de creación antes de considerar lista la etiqueta. La admisión
  física del paquete es una etapa distinta, que requiere seguimiento.

Documentación y mapeos oficiales consultados:
- https://developers.andreani.com/document
- Cotizador: https://a.storyblok.com/f/63950/x/785cfc88f2/api-cotizador-v2-1.xlsx
- Orden: https://a.storyblok.com/f/63950/x/67eaefe2fd/api-orden-envio-3.xlsx

Para continuar faltan confirmar cuenta/acceso API, contrato a domicilio, origen
completo y embalaje real. No se cambió el checkout ni se agregó una tarifa ficticia
de Andreani. El acceso API y los mapeos deben validarse antes de implementarlo.
