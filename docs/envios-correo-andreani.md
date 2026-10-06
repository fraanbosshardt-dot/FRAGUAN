# Envíos: Correo Argentino y Andreani

Actualizado: 6 de octubre de 2026.

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
