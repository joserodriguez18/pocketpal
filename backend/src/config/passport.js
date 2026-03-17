/**
 * @file src/config/passport.js
 * @description Estrategia Google OAuth 2.0 de Passport.
 *
 * Flujo:
 *   1. El usuario hace clic en "Continuar con Google".
 *   2. Passport redirige al servidor de Google con los scopes requeridos.
 *   3. Google redirige a GOOGLE_CALLBACK_URL (variable de entorno) con un código.
 *   4. Passport intercambia el código por tokens y llama a este callback.
 *   5. El callback busca o crea el usuario en la base de datos y llama done().
 *   6. authController.googleCallback() genera el JWT y redirige al dashboard.
 *
 * Variables de entorno requeridas:
 *   GOOGLE_CLIENT_ID       — Client ID de Google Cloud Console
 *   GOOGLE_CLIENT_SECRET   — Client Secret de Google Cloud Console
 *   GOOGLE_CALLBACK_URL    — URL completa del callback (ej: http://localhost:3000/api/auth/google/callback)
 *
 * NOTA DEPLOY: Cambiar GOOGLE_CALLBACK_URL al dominio de producción.
 * También actualizar en Google Cloud Console → APIs → Credenciales → URIs de redireccionamiento.
 */

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { pool } from './db.js';

passport.use(
  new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // GOOGLE_CALLBACK_URL debe incluir el dominio completo.
      // Nunca hardcodear localhost aquí — cambiar la variable para cada entorno.
      callbackURL: "https://pocketpal-production.up.railway.app/api/auth/google/callback",
    },

    /**
     * Callback de verificación de Google.
     * Se ejecuta DESPUÉS de que Google devuelve los tokens.
     *
     * Lógica (en orden):
     *   1. ¿Ya existe un usuario con este google_id? → Login, actualizar tokens.
     *   2. ¿Existe un usuario con este email pero sin google_id? → Vincular cuenta.
     *   3. Ninguno de los anteriores → Registro nuevo.
     *
     * @param {string}   accessToken   — Token de acceso a la API de Google (corta duración).
     * @param {string}   refreshToken  — Token para renovar el access token (larga duración).
     * @param {object}   profile       — Perfil del usuario de Google.
     * @param {Function} done          — Callback de Passport: done(error, user).
     */
    async (accessToken, refreshToken, profile, done) => {
      try {
        const googleId = profile.id;
        const email    = profile.emails[0].value;
        const name     = profile.displayName;
        const avatar   = profile.photos?.[0]?.value || null;

        // ── 1. Login: usuario ya registrado con Google ──
        const [byGoogleId] = await pool.execute(
          'SELECT * FROM users WHERE google_id = ?',
          [googleId],
        );

        if (byGoogleId.length > 0) {
          // Refrescar access token; conservar refresh token si Google no lo reenvió
          await pool.execute(
            `UPDATE users
             SET google_access_token   = ?,
                 google_refresh_token  = ?
             WHERE id = ?`,
            [
              accessToken,
              refreshToken ?? byGoogleId[0].google_refresh_token,
              byGoogleId[0].id,
            ],
          );
          return done(null, { ...byGoogleId[0], isNewUser: false });
        }

        // ── 2. Vinculación: tenía cuenta de email y ahora conecta Google ──
        const [byEmail] = await pool.execute(
          'SELECT * FROM users WHERE email = ?',
          [email],
        );

        if (byEmail.length > 0) {
          await pool.execute(
            `UPDATE users
             SET google_id            = ?,
                 avatar               = ?,
                 google_access_token  = ?,
                 google_refresh_token = ?
             WHERE id = ?`,
            [googleId, avatar, accessToken, refreshToken, byEmail[0].id],
          );
          return done(null, { ...byEmail[0], isNewUser: false });
        }

        // ── 3. Registro: usuario completamente nuevo ──
        const [result] = await pool.execute(
          `INSERT INTO users (name, email, google_id, avatar, google_access_token, google_refresh_token)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [name, email, googleId, avatar, accessToken, refreshToken],
        );

        const [[newUser]] = await pool.execute(
          'SELECT * FROM users WHERE id = ?',
          [result.insertId],
        );

        return done(null, { ...newUser, isNewUser: true });
      } catch (err) {
        console.error('[passport] Error en Google Strategy:', err);
        return done(err, null);
      }
    },
  ),
);

export default passport;
