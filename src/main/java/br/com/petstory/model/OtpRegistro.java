package br.com.petstory.model;

import java.time.LocalDateTime;

/**
 * ============================================================================
 * CLASSE MODELO: OtpRegistro (Token de Autorização Temporária de 6 Dígitos)
 * ============================================================================
 * 
 * O QUE É ESSA CLASSE?
 * Representa um token OTP (One-Time Password) de autorização clínica.
 * No fluxo do PetStory, quando o tutor chega à clínica veterinária, ele clica
 * no botão "Gerar Código de Autorização" no seu aplicativo e recebe um código
 * de 6 dígitos (como "849201").
 * 
 * POR QUE ISSO É NECESSÁRIO NO PROJETO?
 * 1. SEGURANÇA E LGPD: Os dados de saúde do animal e informações pessoais do
 *    tutor não podem ficar públicos para qualquer um ver na internet.
 * 2. AUTORIZAÇÃO CLÍNICA: O código garante que o veterinário só acessará o
 *    prontuário com o consentimento do dono.
 * 3. VALIDADE LIMITADA: O token expira em 2 horas. Depois disso, o acesso é
 *    bloqueado automaticamente a menos que um novo token seja gerado.
 * 
 * CORRESPONDÊNCIA NO BANCO DE DADOS:
 * Espelha a tabela "autorizacoes_otp" do Supabase:
 * - pet_id -> Vincula o token ao pet correspondente
 * - codigo_otp -> Código de 6 dígitos numéricos (ex: "849201")
 * - expira_em -> Timestamp limite de validade
 * - usado -> Booleano que impede que o mesmo token seja reutilizado indevidamente
 */
public class OtpRegistro {

    // ========================================================================
    // ATRIBUTOS
    // ========================================================================

    /** Identificador único do registro no banco de dados */
    private String id;

    /** ID do pet ao qual este token dá acesso */
    private String petId;

    /**
     * O código numérico de 6 dígitos (ex: "849201").
     * Usamos String em vez de int para preservar zeros à esquerda (ex: "012345").
     */
    private String codigoOtp;

    /** Data e hora em que o código foi gerado no sistema */
    private LocalDateTime criadoEm;

    /**
     * Data e hora exata em que o código perde a validade.
     * No PetStory, a sessão clínica dura até 2 horas a partir da geração.
     */
    private LocalDateTime expiraEm;

    /**
     * Flag que indica se o código já foi consumido pelo veterinário.
     * Garante o princípio de "One-Time Password" (senha de uso único).
     */
    private boolean jaUsado;

    /**
     * CRMV do veterinário que utilizou o código para auditoria e rastreabilidade LGPD.
     * Exemplo: "CRMV-SP 12.345"
     */
    private String veterinarioCrmv;

    // ========================================================================
    // CONSTRUTORES
    // ========================================================================

    /** Construtor padrão */
    public OtpRegistro() {
        this.criadoEm = LocalDateTime.now();
        this.expiraEm = this.criadoEm.plusHours(2); // Validade padrão de 2 horas
        this.jaUsado = false;
    }

    /** Construtor com inicialização rápida para geração de token */
    public OtpRegistro(String petId, String codigoOtp) {
        this.petId = petId;
        this.codigoOtp = codigoOtp;
        this.criadoEm = LocalDateTime.now();
        this.expiraEm = this.criadoEm.plusHours(2);
        this.jaUsado = false;
    }

    /** Construtor completo com todos os parâmetros */
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

    // ========================================================================
    // MÉTODOS DE NEGÓCIO AUXILIARES
    // ========================================================================

    /**
     * Verifica se o token já expirou em relação ao momento atual.
     * @return true se a data limite já passou; false se ainda estiver no prazo.
     */
    public boolean isExpirado() {
        if (this.expiraEm == null) return true;
        return LocalDateTime.now().isAfter(this.expiraEm);
    }

    /**
     * Verifica se o token está completamente apto para uso (não expirado e não usado).
     */
    public boolean isValido() {
        return !isExpirado() && !this.jaUsado;
    }

    // ========================================================================
    // GETTERS E SETTERS
    // ========================================================================

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
