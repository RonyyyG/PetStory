package br.com.petstory.model;

import java.time.LocalDate;

// Modelo de dados do animal (espelha a tabela 'pets' do Supabase)
public class Pet {

    private String id;
    private String tutorId;
    private String nome;
    private String especie;
    private String raca;
    private String sexo;
    private LocalDate dataNascimento;
    private Double pesoKg;
    private String alergiasGraves; // Destacado em vermelho no prontuário
    private String codigoTag;      // Código da medalha (ex: PST-9921)
    private boolean ativo;

    public Pet() {
        this.ativo = true;
    }

    public Pet(String id, String tutorId, String nome, String especie, String raca, 
               String sexo, LocalDate dataNascimento, Double pesoKg, 
               String alergiasGraves, String codigoTag) {
        this.id = id;
        this.tutorId = tutorId;
        this.nome = nome;
        this.especie = especie;
        this.raca = raca;
        this.sexo = sexo;
        this.dataNascimento = dataNascimento;
        this.pesoKg = pesoKg;
        this.alergiasGraves = alergiasGraves;
        this.codigoTag = codigoTag;
        this.ativo = true;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getTutorId() {
        return tutorId;
    }

    public void setTutorId(String tutorId) {
        this.tutorId = tutorId;
    }

    public String getNome() {
        return nome;
    }

    public void setNome(String nome) {
        this.nome = nome;
    }

    public String getEspecie() {
        return especie;
    }

    public void setEspecie(String especie) {
        this.especie = especie;
    }

    public String getRaca() {
        return raca;
    }

    public void setRaca(String raca) {
        this.raca = raca;
    }

    public String getSexo() {
        return sexo;
    }

    public void setSexo(String sexo) {
        this.sexo = sexo;
    }

    public LocalDate getDataNascimento() {
        return dataNascimento;
    }

    public void setDataNascimento(LocalDate dataNascimento) {
        this.dataNascimento = dataNascimento;
    }

    public Double getPesoKg() {
        return pesoKg;
    }

    public void setPesoKg(Double pesoKg) {
        this.pesoKg = pesoKg;
    }

    public String getAlergiasGraves() {
        return alergiasGraves;
    }

    public void setAlergiasGraves(String alergiasGraves) {
        this.alergiasGraves = alergiasGraves;
    }

    public String getCodigoTag() {
        return codigoTag;
    }

    public void setCodigoTag(String codigoTag) {
        this.codigoTag = codigoTag;
    }

    public boolean isAtivo() {
        return ativo;
    }

    public void setAtivo(boolean ativo) {
        this.ativo = ativo;
    }

    @Override
    public String toString() {
        return "Pet{" +
                "id='" + id + '\'' +
                ", nome='" + nome + '\'' +
                ", especie='" + especie + '\'' +
                ", raca='" + raca + '\'' +
                ", codigoTag='" + codigoTag + '\'' +
                ", pesoKg=" + pesoKg +
                '}';
    }
}
