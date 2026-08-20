import { Router } from "express";
import { pool } from "@workspace/db";

const router = Router();

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contact_messages (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

ensureTable().catch(console.error);

router.post("/contact", async (req, res) => {
  const { name, email, subject, message } = req.body ?? {};
  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    res.status(400).json({ error: "name, email and message are required" });
    return;
  }
  try {
    const result = await pool.query(
      `INSERT INTO contact_messages (name, email, subject, message, status)
       VALUES ($1, $2, $3, $4, 'pending') RETURNING id`,
      [name.trim(), email.trim(), subject?.trim() || null, message.trim()]
    );
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    req.log.error({ err }, "contact save error");
    res.status(500).json({ error: "Failed to save message" });
  }
});

router.get("/contact", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM contact_messages ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    req.log.error({ err }, "contact fetch error");
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

router.patch("/contact/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { status } = req.body ?? {};
  if (!status) { res.status(400).json({ error: "status required" }); return; }
  try {
    await pool.query(`UPDATE contact_messages SET status=$1 WHERE id=$2`, [status, id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update" });
  }
});

router.delete("/contact/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    await pool.query(`DELETE FROM contact_messages WHERE id=$1`, [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete" });
  }
});

export default router;
