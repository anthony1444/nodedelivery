const express = require("express");
const admin = require("firebase-admin");
const cors = require("cors");

// Cargar credenciales de Firebase Admin
const serviceAccount = require("./serviceAccountKey.json");


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id, // Soluciona el error de Project ID
});

const db = admin.firestore();
const app = express();

app.use(cors());
app.use(express.json());

// Ruta para enviar notificaciones push a usuarios de tipo 3
app.post("/api/enviarNotificacionMasiva", async (req, res) => {
  try {
    const { titulo, mensaje } = req.body;

    // Obtener solo los usuarios con tipo 3
    const tokensSnapshot = await db.collection("users").where("typeUser", "==", 3).get();

    if (tokensSnapshot.empty) {
      return res.status(400).json({ error: "No hay usuarios de tipo 3 disponibles." });
    }

    // Extraer tokens válidos
    const tokens = tokensSnapshot.docs.map((doc) => doc.data().tokenpush).filter(tokenpush => tokenpush);
    console.log(tokens);
    
    if (tokens.length === 0) {
      return res.status(400).json({ error: "No se encontraron tokens válidos." });
    }

    // Crear payload de la notificación
    const payload = {
      notification: {
        title: titulo || "Notificación",
        body: mensaje || "Mensaje predeterminado",
      },
      tokens,
    };

    // Enviar notificación a múltiples dispositivos
    const response = await admin.messaging().sendEachForMulticast(payload);

    return res.status(200).json({ success: true, response });
  } catch (error) {
    console.error("Error enviando notificación:", error);
    return res.status(500).json({ error: error.message });
  }
});

// Definir puerto
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
