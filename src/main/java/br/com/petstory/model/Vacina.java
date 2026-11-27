package br.com.petstory.model;

import java.time.LocalDate;

// Modelo de uma dose aplicada no pet (espelha a tabela 'vacinas' do Supabase)
public class Vacina {

    private String id;
    private String petId;
    private String nomeVacina;
    private LocalDate dataAplicacao;
    private LocalDate dataReforco;
    private String loteFabricante;
    private String veterinarioResponsavel;
    private String status; // "Em Dia", "Próximo do Reforço" ou "Atrasada"

    public Vacina() {
    }

    public Vacina(String id, String petId, String nomeVacina, 
                  LocalDate dataAplicacao, LocalDate dataReforco, 
                  String loteFabricante, String veterinarioResponsavel) {
        this.id = id;
        this.petId = petId;
        this.nomeVacina = nomeVacina;
        this.dataAplicacao = dataAplicacao;
        this.dataReforco = dataReforco;
        this.loteFabricante = loteFabricante;
        this.veterinarioResponsavel = veterinarioResponsavel;
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

    public String getNomeVacina() {
        return nomeVacina;
    }

    public void setNomeVacina(String nomeVacina) {
        this.nomeVacina = nomeVacina;
    }

    public LocalDate getDataAplicacao() {
        return dataAplicacao;
    }

    public void setDataAplicacao(LocalDate dataAplicacao) {
        this.dataAplicacao = dataAplicacao;
    }

    public LocalDate getDataReforco() {
        return dataReforco;
    }

    public void setDataReforco(LocalDate dataReforco) {
        this.dataReforco = dataReforco;
    }

    public String getLoteFabricante() {
        return loteFabricante;
    }

    public void setLoteFabricante(String loteFabricante) {
        this.loteFabricante = loteFabricante;
    }

    public String getVeterinarioResponsavel() {
        return veterinarioResponsavel;
    }

    public void setVeterinarioResponsavel(String veterinarioResponsavel) {
        this.veterinarioResponsavel = veterinarioResponsavel;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    @Override
    public String toString() {
        return "Vacina{" +
                "nomeVacina='" + nomeVacina + '\'' +
                ", dataAplicacao=" + dataAplicacao +
                ", dataReforco=" + dataReforco +
                ", loteFabricante='" + loteFabricante + '\'' +
                '}';
    }
}
