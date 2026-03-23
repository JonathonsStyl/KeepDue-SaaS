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

app.get('/export-files', isAuthenticated, (req, res) => {
    // Fetch only records that actually have an associated encrypted file
    db.all("SELECT * FROM items WHERE user_id = ? AND file_path IS NOT NULL", [req.session.userId], (err, rows) => {
        if (err) return res.status(500).send("Database error");
        
        if (!rows || rows.length === 0) {
            return res.redirect('/settings?message=nofiles');
        }

        // Set headers to immediately trigger a file download in the user's browser
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename="KeepDue_Secure_Export.zip"');

        // Initialize archiver with maximum compression
        const archive = archiver('zip', {
            zlib: { level: 9 } 
        });

        archive.on('error', (err) => {
            console.error("❌ Archiver Error:", err);
            res.status(500).end();
        });

        // Pipe the zip archive directly to the HTTP response stream
        archive.pipe(res);

        rows.forEach(row => {
            const fullPath = path.join(__dirname, row.file_path);
            
            if (fs.existsSync(fullPath)) {
                
                // Sanitize the filename to prevent ZIP corruption from special characters
                const decTitle = decryptText(row.title);
                const safeTitle = decTitle.replace(/[^a-zA-Z0-9α-ωΑ-Ω]/g, '_').substring(0, 30);
                const ext = path.extname(row.file_path).toLowerCase();
                const fileNameInZip = `${safeTitle}_${row.id}${ext}`;

                if (row.iv) {
                    try {
                        // Determine algorithm based on whether an auth tag exists (GCM vs CTR)
                        const algorithm = row.auth_tag ? 'aes-256-gcm' : 'aes-256-ctr';
                        const decipher = crypto.createDecipheriv(algorithm, secretKey, Buffer.from(row.iv, 'hex'));
                        
                        if (row.auth_tag) {
                            decipher.setAuthTag(Buffer.from(row.auth_tag, 'hex'));
                        }

                        // Create a read stream of the encrypted file, pipe it through the decipher, 
                        // and append the resulting stream directly into the ZIP archive.
                        const input = fs.createReadStream(fullPath);
                        archive.append(input.pipe(decipher), { name: fileNameInZip });
                    } catch (err) {
                        console.error("ZIP Decryption Error:", err);
                    }
                } else {
                    // Fallback for unencrypted legacy files, if any exist
                    archive.file(fullPath, { name: fileNameInZip });
                }
            }
        });

        // Finalize the archive (this flushes the streams and completes the HTTP response)
        archive.finalize();
        
        logAction(`DATA EXPORT: User ${req.session.userId} downloaded a bulk ZIP of their files.`);
    });
});
