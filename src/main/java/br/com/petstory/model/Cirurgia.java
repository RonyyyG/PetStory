package br.com.petstory.model;

import java.time.LocalDateTime;

// Modelo de cirurgia ou procedimento agendado para o pet
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
