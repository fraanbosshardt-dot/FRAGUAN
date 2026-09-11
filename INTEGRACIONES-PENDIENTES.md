# FRAGUAN — integraciones pendientes de lanzamiento

Actualizado: 11 de septiembre de 2026.

Este es el orden de trabajo aprobado para conectar servicios reales. El desarrollo continúa
en local y GitHub; ninguna etapa autoriza un deploy.

## 1. Google Auth para el personal

- Crear un cliente OAuth exclusivo para Administración y POS, con callbacks internos
  específicos y orígenes exactos.
- Verificar el token o código de Google únicamente en el backend: emisor, audiencia,
  vencimiento, email verificado, `state` y `nonce`.
- Usar la tabla de usuarios internos activos como whitelist. Tener una cuenta Google válida
  no alcanza para entrar: el email debe existir, estar activo y conservar su rol en FRAGUAN.
- VENDEDOR entra al POS; ADMIN y GERENTE acceden a sus áreas permitidas. Administración
  continúa exigiendo el PIN después del login Google.
- Crear sesiones propias `HttpOnly`, `Secure`, `SameSite`, rotables y con vencimiento. Cada
  venta, devolución, pedido preparado y acción administrativa conserva el usuario real.

## 2. Google Auth para clientes

- Usar un cliente OAuth separado del personal.
- Vincular por email verificado con `customer_accounts` y `customers`, y mantener separadas las
  cookies, callbacks y autorizaciones internas.
- Permitir compra como invitado y ofrecer login para pedidos, direcciones, favoritos y Club.
- El login de tienda nunca consulta roles internos ni permite usar `/pos`, `/admin` o sus APIs.

## 3. Resend

- Verificar un subdominio remitente, SPF, DKIM y DMARC.
- Configurar remitente transaccional y destinatario interno de pedidos.
- Activar códigos de verificación, confirmación y estados del pedido, recuperación de
  carrito, reposición, newsletter y bajas.
- Guardar idempotencia, resultado del envío y reintentos; nunca registrar códigos, tokens ni
  datos personales completos en logs.

## 4. Correo Argentino

- Cargar credenciales de MiCorreo, customer ID y código postal de origen.
- Cotizar en el servidor usando peso, dimensiones, destino y modalidad real.
- Validar costo y servicio otra vez al confirmar el pedido; importar el envío una sola vez.
- Guardar etiqueta, tracking y eventos. Probar domicilio, sucursal, rechazo, reintento,
  cancelación y devolución antes de habilitarlo.

## 5. Transferencia bancaria

- Cargar titular, CUIT/CUIL, banco, alias y CBU/CVU mediante variables de entorno.
- Mostrar estos datos después de crear el pedido, junto con el importe exacto y la referencia
  única `FRG-...`.
- El aviso del cliente no acredita el pedido. La acreditación requiere conciliación bancaria
  o confirmación administrativa contra referencia e importe exactos.
- Probar pagos insuficientes, excedentes, duplicados, vencidos y referencias reutilizadas.

## 6. Tarjetas y QR online

- Elegir entre Mercado Pago y Naranja X después de confirmar comisiones, medios disponibles,
  API ecommerce, checkout, cuotas, QR, reembolsos, contracargos y webhooks para la cuenta
  comercial real de FRAGUAN.
- Mantener un adaptador por proveedor. El backend crea la preferencia y define el importe;
  el navegador nunca confirma un pago.
- Acreditar solamente después de firma válida y consulta directa al proveedor. Conservar
  idempotencia y reconciliar pedido, pago, venta y stock.

## Datos necesarios para ejecutar la conexión

1. Dos configuraciones OAuth de Google: personal y clientes.
2. Lista inicial de emails internos, nombre y rol de cada usuario.
3. Dominio/subdominio remitente y API key de Resend.
4. Credenciales productivas o de prueba de MiCorreo y datos físicos del paquete/origen.
5. Titular, identificación tributaria, banco, alias y CBU/CVU de transferencias.
6. Cuenta comercial y credenciales sandbox del proveedor de pago elegido.

Todos los secretos se cargan en el entorno local o gestor del proveedor. No se escriben en
Git, documentación, capturas ni mensajes de commit.
