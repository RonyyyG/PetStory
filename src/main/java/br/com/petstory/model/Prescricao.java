package br.com.petstory.model;

import java.time.LocalDateTime;

/**
 * ============================================================================
 * CLASSE MODELO: Prescricao (Medicamentos e Tratamentos Clínicos do Pet)
 * ============================================================================
 * Representa uma prescrição médica emitida por médico-veterinário:
 * - id: Identificador único (UUID)
 * - petId: Vínculo com o animal
 * - nome: Nome do medicamento e dosagem (ex: "Apoquel 16mg")
 * - tipo: Via de administração ou regime (ex: "Uso Contínuo", "Oral", "Tópico")
 * - indicacao: Motivo clínico do uso
 * - posologia: Modo de usar e frequência
 * - veterinario: Identificação e CRMV do prescritor
 * - status: "Ativo" ou "Suspenso"
 */
public class Prescricao {

    private String id;
    private String petId;
    private String nome;
    private String tipo;
    private String indicacao;
    private String posologia;
    private String veterinario;
    private String status;
    private LocalDateTime createdAt;

    public Prescricao() {
        this.status = "Ativo";
        this.createdAt = LocalDateTime.now();
    }

    public Prescricao(String id, String petId, String nome, String tipo, String indicacao, String posologia, String veterinario, String status) {
        this.id = id;
        this.petId = petId;
        this.nome = nome;
        this.tipo = tipo != null ? tipo : "Oral";
        this.indicacao = indicacao;
        this.posologia = posologia;
        this.veterinario = veterinario;
        this.status = status != null ? status : "Ativo";
        this.createdAt = LocalDateTime.now();
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

    public String getNome() {
        return nome;
    }

    public void setNome(String nome) {
        this.nome = nome;
    }

    public String getTipo() {
        return tipo;
    }

    public void setTipo(String tipo) {
        this.tipo = tipo;
    }

    public String getIndicacao() {
        return indicacao;
    }

    public void setIndicacao(String indicacao) {
        this.indicacao = indicacao;
    }

    public String getPosologia() {
        return posologia;
    }

    public void setPosologia(String posologia) {
        this.posologia = posologia;
    }

    public String getVeterinario() {
        return veterinario;
    }

    public void setVeterinario(String veterinario) {
        this.veterinario = veterinario;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
