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

// Ruta para actualizar el estado de las órdenes masivamente
app.post("/api/updateStatus", async (req, res) => {
  try {
    const { currentstatus, newstatus } = req.body;

    if (!currentstatus || !newstatus) {
      return res.status(400).json({ error: "Parámetros currentstatus y newstatus son requeridos." });
    }

    // Referencia a la colección 'orders' (Asumido, cambiar si es otra colección)
    const collectionRef = db.collection("orders");
    const snapshot = await collectionRef.where("status", "==", currentstatus).get();

    if (snapshot.empty) {
      return res.status(404).json({ message: `No se encontraron órdenes con estado ${currentstatus}.` });
    }

    // Firestore permite batches de hasta 500 operaciones
    const batch = db.batch();
    let count = 0;

    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, { status: newstatus });
      count++;
    });

    await batch.commit();

    return res.status(200).json({
      success: true,
      message: `Se actualizaron ${count} órdenes de '${currentstatus}' a '${newstatus}'.`
    });

  } catch (error) {
    console.error("Error actualizando estados:", error);
    return res.status(500).json({ error: error.message });
  }
});

// Definir puerto
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
