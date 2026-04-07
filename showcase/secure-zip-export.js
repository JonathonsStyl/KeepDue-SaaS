/**
 * KeepDue Secure Export Module
 * * This route handles the bulk export of user documents.
 * Architecture Highlights:
 * 1. Zero-Disk Decryption: Files are decrypted on-the-fly using Node.js crypto streams. 
 * Decrypted data is NEVER written to the server's disk.
 * 2. Memory Efficiency: Uses 'archiver' to stream the decrypted buffers directly 
 * into a ZIP file that is piped straight to the client's HTTP response.
 * 3. Dynamic Fallbacks: Handles both AES-256-GCM (authenticated) and legacy AES-256-CTR.
 */

app.get('/export-files', isAuthenticated, requireRole(['owner', 'editor']), (req, res) => {
    db.all("SELECT * FROM items WHERE workspace_id = ? AND file_path IS NOT NULL", [req.session.workspaceId], async (err, rows) => {
        if (err) return res.status(500).send("Database error");
        
        if (!rows || rows.length === 0) {
            return res.redirect('/settings?message=nofiles');
        }

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename="KeepDue_Secure_Export.zip"');

        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.pipe(res);

        for (const row of rows) {
            const fullPath = path.join(__dirname, row.file_path);
            if (fs.existsSync(fullPath)) {
                const decTitle = decryptText(row.title);
                const safeTitle = decTitle.replace(/[^a-zA-Z0-9α-ωΑ-Ω]/g, '_').substring(0, 30);
                const ext = path.extname(row.file_path).toLowerCase();
                const fileNameInZip = `${safeTitle}_${row.id}${ext}`;

                if (row.iv) {
                    try {
                        const algorithm = row.auth_tag ? 'aes-256-gcm' : 'aes-256-ctr';
                        const decipher = crypto.createDecipheriv(algorithm, secretKey, Buffer.from(row.iv, 'hex'));
                        if (row.auth_tag) decipher.setAuthTag(Buffer.from(row.auth_tag, 'hex'));

                        const input = fs.createReadStream(fullPath);
                        archive.append(input.pipe(decipher), { name: fileNameInZip });
                        
                        // Critical: Wait for this file to be fully appended before moving to the next
                        await new Promise(resolve => input.on('end', resolve));

                    } catch (err) {
                        console.error("ZIP Decryption Error:", err);
                    }
                } else {
                    archive.file(fullPath, { name: fileNameInZip });
                }
            }
        }
        
        archive.finalize();
        recordAudit(req.session.workspaceId, req.session.userId, AuditActions.DATA_EXPORTED, { format: 'zip' });
    });
});
