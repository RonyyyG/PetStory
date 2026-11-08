package br.com.petstory.model;

import java.time.LocalDate;

/**
 * ============================================================================
 * CLASSE MODELO: Vacina (Registro da Carteirinha de Vacinação Inteligente)
 * ============================================================================
 * 
 * O QUE É ESSA CLASSE?
 * Modela uma dose de vacina aplicada no pet. No PetStory, a carteirinha de
 * vacinação não é um papel que o dono pode perder na gaveta: é um histórico
 * digital centralizado e assinado por médicos-veterinários credenciados.
 * 
 * POR QUE ELA EXISTE?
 * Para gerenciar a imunização do animal, calcular automaticamente quando vence
 * o reforço (ex: anual) e alertar o tutor antes que a vacina fique atrasada.
 * 
 * SOBRE AS 4 VACINAS INICIAIS NO BANCO (SUPABASE):
 * Como conversamos anteriormente, as 4 vacinas presentes inicialmente no banco
 * (V10 Polivalente, Antirrábica, Gripe Canina e Giárdia) são a carga inicial (seed)
 * do paciente Thor. A cada nova consulta, o próprio veterinário cadastra as novas
 * vacinas aplicadas com seu CRMV e lote, e elas são salvas na tabela 'vacinas'.
 */
public class Vacina {

    // ========================================================================
    // ATRIBUTOS
    // ========================================================================

    /** Identificador do registro da vacina no banco de dados */
    private String id;

    /** ID do pet que recebeu a vacina */
    private String petId;

    /** Nome comercial / laboratorial da vacina (ex: "V10 Polivalente", "Antirrábica") */
    private String nomeVacina;

    /** Data em que a dose foi injetada no animal */
    private LocalDate dataAplicacao;

    /**
     * Data limite recomendada para o reforço da dose (geralmente 1 ano após a aplicação).
     * O sistema usa essa data para calcular o status: Em Dia, Próximo do Reforço ou Atrasada.
     */
    private LocalDate dataReforco;

    /** Número do lote e fabricante da vacina para segurança e rastreamento sanitário */
    private String loteFabricante;

    /** Nome e CRMV do médico-veterinário responsável pela aplicação */
    private String veterinarioResponsavel;

    /** Status sanitário calculado: "Em Dia", "Próximo do Reforço", "Atrasada" */
    private String status;

    // ========================================================================
    // CONSTRUTORES
    // ========================================================================

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
