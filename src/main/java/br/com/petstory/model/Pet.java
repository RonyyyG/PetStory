package br.com.petstory.model;

import java.time.LocalDate;

/**
 * ============================================================================
 * CLASSE MODELO: Pet (POJO - Plain Old Java Object)
 * ============================================================================
 * 
 * O QUE É ESSA CLASSE?
 * Esta classe é o modelo de dados ("Entidade") que representa um animal
 * cadastrado no sistema PetStory. Em Java, chamamos isso de POJO, que é uma
 * classe simples contendo atributos privados, construtores e métodos Getters/Setters.
 * 
 * POR QUE ELA EXISTE?
 * Para que o backend em Java possa manipular as informações de um animal na memória,
 * salvar no banco de dados (Supabase / PostgreSQL) ou devolver essas informações
 * formatadas para o frontend ou para a API.
 * 
 * CORRESPONDÊNCIA NO BANCO DE DADOS:
 * Esta classe reflete exatamente as colunas da tabela "pets" que criamos no Supabase:
 * - id -> Chave primária do pet (UUID)
 * - nome -> Nome do pet (ex: Thor)
 * - especie -> Canina, Felina, etc.
 * - raca -> Raça (ex: Golden Retriever)
 * - pesoKg -> Peso atual em kg (ex: 32.8)
 * - alergiasGraves -> Alertas médicos vitais (ex: Dipirona e Sulfas)
 * - codigoTag -> Código da medalha inteligente (ex: PST-9921)
 */
public class Pet {

    // ========================================================================
    // ATRIBUTOS PRIVADOS (Princípio do Encapsulamento da Programação Orientada a Objetos)
    // ========================================================================
    
    /** Identificador único do pet no banco de dados (UUID gerado pelo Supabase) */
    private String id;

    /** Identificador do dono/tutor responsável pelo pet */
    private String tutorId;

    /** Nome de registro do animal (ex: Thor, Luna) */
    private String nome;

    /** Espécie do animal (ex: "Canina", "Felina") */
    private String especie;

    /** Raça do animal (ex: "Golden Retriever", "Siamês") */
    private String raca;

    /** Sexo e status reprodutivo (ex: "Macho - Castrado", "Fêmea") */
    private String sexo;

    /** Data aproximada de nascimento do animal */
    private LocalDate dataNascimento;

    /** Peso corporal atual do pet em quilogramas (ex: 32.8) */
    private Double pesoKg;

    /**
     * Alergias severas e restrições medicamentosas críticas.
     * Esse campo é destacado em vermelho no prontuário para evitar erros médicos.
     */
    private String alergiasGraves;

    /**
     * Código único da Tag inteligente gravado na medalha/QR Code da coleira (ex: PST-9921).
     * É o identificador que o veterinário ou quem encontrar o pet utiliza para buscar os dados.
     */
    private String codigoTag;

    /** Status do cadastro (true = ativo, false = inativo) */
    private boolean ativo;

    // ========================================================================
    // CONSTRUTORES (Permitem criar instâncias do Pet de diferentes formas)
    // ========================================================================

    /**
     * Construtor padrão sem argumentos (necessário para bibliotecas como Gson
     * converterem JSON em objeto Java automaticamente).
     */
    public Pet() {
        this.ativo = true;
    }

    /**
     * Construtor completo para inicializar todos os dados do animal de uma vez só.
     */
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

    // ========================================================================
    // MÉTODOS GETTERS E SETTERS
    // (Permitem ler e modificar os atributos privados de forma controlada)
    // ========================================================================

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

    /**
     * Método auxiliar para imprimir os dados do pet de forma amigável no console.
     */
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
