package br.com.petstory.model;

import java.time.LocalDateTime;

/**
 * ============================================================================
 * CLASSE MODELO: Veterinario (Profissional Clínico com CRMV)
 * ============================================================================
 * Espelha a tabela "veterinarios" do Supabase:
 * - id (UUID)
 * - nome
 * - crmv (ex: "CRMV-SP 38.412")
 * - clinica
 * - especialidade
 * - created_at
 */
public class Veterinario {

    private String id;
    private String nome;
    private String crmv;
    private String clinica;
    private String especialidade;
    private String email;
    private String senhaHash;
    private Boolean ativo;
    private LocalDateTime createdAt;

    public Veterinario() {
    }

    public Veterinario(String id, String nome, String crmv, String clinica, String especialidade) {
        this.id = id;
        this.nome = nome;
        this.crmv = crmv;
        this.clinica = clinica;
        this.especialidade = especialidade;
    }

    public Veterinario(String id, String nome, String crmv, String clinica, String especialidade, String email, Boolean ativo) {
        this.id = id;
        this.nome = nome;
        this.crmv = crmv;
        this.clinica = clinica;
        this.especialidade = especialidade;
        this.email = email;
        this.ativo = ativo;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getNome() {
        return nome;
    }

    public void setNome(String nome) {
        this.nome = nome;
    }

    public String getCrmv() {
        return crmv;
    }

    public void setCrmv(String crmv) {
        this.crmv = crmv;
    }

    public String getClinica() {
        return clinica;
    }

    public void setClinica(String clinica) {
        this.clinica = clinica;
    }

    public String getEspecialidade() {
        return especialidade;
    }

    public void setEspecialidade(String especialidade) {
        this.especialidade = especialidade;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getSenhaHash() {
        return senhaHash;
    }

    public void setSenhaHash(String senhaHash) {
        this.senhaHash = senhaHash;
    }

    public Boolean getAtivo() {
        return ativo;
    }

    public void setAtivo(Boolean ativo) {
        this.ativo = ativo;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
