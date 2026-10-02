// Datos de conexión con Supabase (la base de datos del panel).
//
// SEGURO de tener acá (es público, lo puede ver cualquiera que abra el sitio):
//   - La dirección del proyecto (Project URL)
//   - La clave pública (Publishable key, empieza con sb_publishable_)
//
// NUNCA pongas en este archivo:
//   - La clave secreta (secret key) ni la service_role
//   - La contraseña de la base de datos
//   - Contraseñas de las personas
//
// Lo que protege los datos no es esconder la clave: son las reglas de seguridad
// de la base de datos (script db/01-tablas.sql), que solo dejan entrar a los
// administradores autorizados.
window.COLISEO_CONFIG = {
  SUPABASE_URL: 'https://hlauxcfcpmltanwplrvk.supabase.co',
  SUPABASE_KEY: 'sb_publishable_8nHaV46rAwcyAd3it3BikQ_cXpjdvYP',
};
