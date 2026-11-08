package br.com.petstory.model;

import java.time.LocalDateTime;

/**
 * ============================================================================
 * CLASSE MODELO: Cirurgia (Procedimentos Cirúrgicos e Agendamentos Clínicos)
 * ============================================================================
 * Representa um procedimento cirúrgico agendado ou realizado:
 * - id: Identificador único (UUID)
 * - petId: Vínculo com o animal
 * - nome: Nome da cirurgia (ex: "Castração Eletiva", "Profilaxia Dentária")
 * - data: Data e hora programada (ex: "15/11/2026")
 * - cirurgiao: Nome e CRMV do cirurgião
 * - notas: Orientações de jejum e pós-operatório
 * - status: "Agendada", "Realizada", "Cancelada"
 */
public class Cirurgia {

    private String id;
    private String petId;
    private String nome;
    private String data;
    private String cirurgiao;
    private String notas;
    private String status;
    private LocalDateTime createdAt;

    public Cirurgia() {
        this.status = "Agendada";
        this.createdAt = LocalDateTime.now();
    }

    public Cirurgia(String id, String petId, String nome, String data, String cirurgiao, String notas, String status) {
        this.id = id;
        this.petId = petId;
        this.nome = nome;
        this.data = data;
        this.cirurgiao = cirurgiao;
        this.notas = notas;
        this.status = status != null ? status : "Agendada";
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

    public String getData() {
        return data;
    }

    public void setData(String data) {
        this.data = data;
    }

    public String getCirurgiao() {
        return cirurgiao;
    }

    public void setCirurgiao(String cirurgiao) {
        this.cirurgiao = cirurgiao;
    }

    public String getNotas() {
        return notas;
    }

    public void setNotas(String notas) {
        this.notas = notas;
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
