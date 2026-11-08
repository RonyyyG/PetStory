package br.com.petstory.model;

import java.time.LocalDateTime;

/**
 * ============================================================================
 * CLASSE MODELO: Tutor (Dono do Animal)
 * ============================================================================
 * Espelha a tabela "tutores" do Supabase:
 * - id (UUID)
 * - nome
 * - telefone_emergencia
 * - email
 * - cidade
 * - created_at
 */
public class Tutor {

    private String id;
    private String nome;
    private String telefoneEmergencia;
    private String email;
    private String cidade;
    private LocalDateTime createdAt;

    public Tutor() {
    }

    public Tutor(String id, String nome, String telefoneEmergencia, String email, String cidade) {
        this.id = id;
        this.nome = nome;
        this.telefoneEmergencia = telefoneEmergencia;
        this.email = email;
        this.cidade = cidade;
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

    public String getTelefoneEmergencia() {
        return telefoneEmergencia;
    }

    public void setTelefoneEmergencia(String telefoneEmergencia) {
        this.telefoneEmergencia = telefoneEmergencia;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getCidade() {
        return cidade;
    }

    public void setCidade(String cidade) {
        this.cidade = cidade;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
