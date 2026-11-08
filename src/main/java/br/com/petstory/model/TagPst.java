package br.com.petstory.model;

import java.time.LocalDateTime;

/**
 * ============================================================================
 * CLASSE MODELO: TagPst (Medalha Inteligente QR/NFC)
 * ============================================================================
 * Espelha a tabela "tags" do Supabase:
 * - codigo (ex: "PST-9921", "PST-1428")
 * - pet_id (UUID)
 * - nfc_uid
 * - ativa (boolean)
 * - created_at
 */
public class TagPst {

    private String codigo;
    private String petId;
    private String nfcUid;
    private boolean ativa;
    private LocalDateTime createdAt;

    public TagPst() {
    }

    public TagPst(String codigo, String petId, String nfcUid, boolean ativa) {
        this.codigo = codigo;
        this.petId = petId;
        this.nfcUid = nfcUid;
        this.ativa = ativa;
    }

    public String getCodigo() {
        return codigo;
    }

    public void setCodigo(String codigo) {
        this.codigo = codigo;
    }

    public String getPetId() {
        return petId;
    }

    public void setPetId(String petId) {
        this.petId = petId;
    }

    public String getNfcUid() {
        return nfcUid;
    }

    public void setNfcUid(String nfcUid) {
        this.nfcUid = nfcUid;
    }

    public boolean isAtiva() {
        return ativa;
    }

    public void setAtiva(boolean ativa) {
        this.ativa = ativa;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
