package br.com.petstory.model;

import java.time.LocalDateTime;

// Token temporário de 6 dígitos (espelha a tabela 'autorizacoes_otp', uso único e validade de 2h)
public class OtpRegistro {

    private String id;
    private String petId;
    private String codigoOtp; // String para preservar zeros à esquerda (ex: "012345")
    private LocalDateTime criadoEm;
    private LocalDateTime expiraEm;
    private boolean jaUsado;
    private String veterinarioCrmv;

    public OtpRegistro() {
        this.criadoEm = LocalDateTime.now();
        this.expiraEm = this.criadoEm.plusHours(2);
        this.jaUsado = false;
    }

    public OtpRegistro(String petId, String codigoOtp) {
        this.petId = petId;
        this.codigoOtp = codigoOtp;
        this.criadoEm = LocalDateTime.now();
        this.expiraEm = this.criadoEm.plusHours(2);
        this.jaUsado = false;
    }

    public OtpRegistro(String id, String petId, String codigoOtp, 
                       LocalDateTime criadoEm, LocalDateTime expiraEm, 
                       boolean jaUsado, String veterinarioCrmv) {
        this.id = id;
        this.petId = petId;
        this.codigoOtp = codigoOtp;
        this.criadoEm = criadoEm;
        this.expiraEm = expiraEm;
        this.jaUsado = jaUsado;
        this.veterinarioCrmv = veterinarioCrmv;
    }

    public boolean isExpirado() {
        if (this.expiraEm == null) return true;
        return LocalDateTime.now().isAfter(this.expiraEm);
    }

    public boolean isValido() {
        return !isExpirado() && !this.jaUsado;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getPetId() {
        return petId;
    }

    public void setPetId(String petId) {
        this.petId = petId;
    }

    public String getCodigoOtp() {
        return codigoOtp;
    }

    public void setCodigoOtp(String codigoOtp) {
        this.codigoOtp = codigoOtp;
    }

    public LocalDateTime getCriadoEm() {
        return criadoEm;
    }

    public void setCriadoEm(LocalDateTime criadoEm) {
        this.criadoEm = criadoEm;
    }

    public LocalDateTime getExpiraEm() {
        return expiraEm;
    }

    public void setExpiraEm(LocalDateTime expiraEm) {
        this.expiraEm = expiraEm;
    }

    public boolean isJaUsado() {
        return jaUsado;
    }

    public void setJaUsado(boolean jaUsado) {
        this.jaUsado = jaUsado;
    }

    public String getVeterinarioCrmv() {
        return veterinarioCrmv;
    }

    public void setVeterinarioCrmv(String veterinarioCrmv) {
        this.veterinarioCrmv = veterinarioCrmv;
    }

    @Override
    public String toString() {
        return "OtpRegistro{" +
                "petId='" + petId + '\'' +
                ", codigoOtp='" + codigoOtp + '\'' +
                ", expiraEm=" + expiraEm +
                ", jaUsado=" + jaUsado +
                '}';
    }
}
