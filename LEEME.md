# Rifa ¡Bono de apoyo! · Samuel Castro

Página de la rifa para publicar en Netlify. Los compradores escogen sus números,
los apartan con su nombre y le avisan a Samuel por WhatsApp. Samuel entra con un
código secreto para confirmar los pagos, editar o liberar números.

## Qué hay en la carpeta

- `public/index.html`: la página.
- `netlify/functions/rifa.mjs`: el servidor, que guarda los datos y revisa el código de administrador.
- `netlify/lib/semilla.mjs`: los datos iniciales (la libreta). Solo se usan la primera vez.
- `netlify.toml` y `package.json`: la configuración de Netlify.

## Publicarla (una sola vez)

Importante: **no sirve arrastrar la carpeta a Netlify Drop**, porque así no se instala
el servidor. Hay que usar uno de estos dos caminos:

### Opción A: con GitHub (recomendada)
1. Crea un repositorio en GitHub y sube todo el contenido de esta carpeta.
2. En https://app.netlify.com entra a **Add new site → Import an existing project** y escoge el repositorio.
3. Deja la configuración como viene: Netlify la lee de `netlify.toml`. Pulsa **Deploy**.

### Opción B: desde la computadora, con Node.js instalado
```
npm install
npx netlify-cli login
npx netlify-cli deploy --prod
```

## Poner el código de administrador

1. En Netlify abre el sitio y entra a **Site configuration → Environment variables**.
2. Agrega la variable `ADMIN_CODE` con el código de Samuel (mínimo 6 caracteres).
3. Entra a **Deploys → Trigger deploy → Deploy site** para que tome el código.

Sin esta variable nadie puede administrar.

## Cómo la usa Samuel

- Abre la página, baja hasta el final y toca **Soy el responsable**. Escribe el código.
- El celular lo recuerda. Para cerrar la sesión toca **Salir**.
- Al tocar un número puede ponerlo como Libre, Reservado o Pagado, y cambiar el nombre, el teléfono o la nota.
- En **Compradores**, el botón **Confirmar pago** marca como pagados todos los números de esa persona.
- En **Ajustes** cambia el WhatsApp y pone el número ganador después del sorteo.

## Cambiar el código

Cambia `ADMIN_CODE` en Netlify y vuelve a publicar con Trigger deploy. El código viejo deja de funcionar.

## Bueno saber

- Los visitantes solo ven qué números están libres, apartados o vendidos. Nunca ven nombres ni teléfonos.
- Cualquiera puede apartar números libres desde la página (hasta 10 por vez). Si alguien aparta y no paga, Samuel libera el número.
- Los datos quedan guardados en Netlify Blobs, dentro del mismo sitio. No hace falta base de datos.
