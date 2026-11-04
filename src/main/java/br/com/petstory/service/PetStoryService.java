package br.com.petstory.service;

import br.com.petstory.model.OtpRegistro;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Random;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * ============================================================================
 * CLASSE DE SERVIÇO: PetStoryService (Lógica de Negócio do Backend)
 * ============================================================================
 * 
 * O QUE É ESTA CLASSE?
 * É a camada de serviço (Service Layer). Em arquitetura de software, esta classe
 * concentra todas as "regras de negócio" do sistema PetStory.
 * 
 * POR QUE ELA EXISTE?
 * Para isolar a inteligência do sistema. Nem a tela (frontend/HTML), nem o banco de
 * dados (Supabase/SQL) devem tomar decisões complexas sozinhos.
 * Quem decide se uma tag é válida, se um código OTP expirou ou se uma vacina está
 * atrasada é esta classe em Java.
 * 
 * POR QUE ISSO É IMPORTANTE PARA A APRESENTAÇÃO ACADÊMICA (A3)?
 * Como seu professor ensinou testes de unidade em Java (como na calculadora),
 * criar esta classe permite que você teste cada regra de negócio de forma isolada,
 * usando JUnit 5 com 'assertEquals', 'assertTrue' e 'assertFalse', sem depender
 * de internet, servidor web ou telas abertas.
 */
public class PetStoryService {

    // Gerador de números pseudoaleatórios para tags e OTPs
    private final Random random;

    // Expressão regular para validar o formato oficial da tag: "PST-" seguido de 4 dígitos
    private static final Pattern PADRAO_TAG_PST = Pattern.compile("^PST-\\d{4}$");

    // Expressão regular para validar microchips padrão internacional ISO 11784/11785 (15 dígitos)
    private static final Pattern PADRAO_MICROCHIP = Pattern.compile("^\\d{15}$");

    /**
     * Construtor padrão da classe de serviço.
     */
    public PetStoryService() {
        this.random = new Random();
    }

    /**
     * Construtor que aceita uma instância customizada de Random (útil para testes com seed fixo).
     */
    public PetStoryService(Random random) {
        this.random = random;
    }

    // ========================================================================
    // REGRA DE NEGÓCIO 1: GERAÇÃO INTELIGENTE DE CÓDIGO DE TAG (SEM COLISÃO)
    // ========================================================================

    /**
     * Gera um novo código de identificação de tag no formato "PST-XXXX",
     * garantindo matematicamente que o código gerado NÃO colida (não seja duplicado)
     * com nenhum código já existente no banco de dados.
     * 
     * COMO FUNCIONA O TRATAMENTO DE COLISÃO?
     * 1. Sorteamos um número aleatório entre 1000 e 9999.
     * 2. Montamos a String "PST-" + número.
     * 3. Verificamos se o conjunto 'tagsExistentes' já possui esse código.
     * 4. Se já existir (colisão), o laço 'do-while' repete o sorteio até encontrar um código livre.
     * 5. Um contador de segurança impede loops infinitos caso todas as tags do universo estejam esgotadas.
     * 
     * @param tagsExistentes Conjunto de tags já cadastradas no banco de dados.
     * @return Uma String contendo a nova tag única (ex: "PST-9921").
     * @throws IllegalStateException se não houver mais códigos disponíveis no intervalo.
     */
    public String gerarCodigoTag(Set<String> tagsExistentes) {
        int tentativas = 0;
        final int MAX_TENTATIVAS = 10000;
        String codigoGerado;

        do {
            // Sorteia um número de 4 dígitos entre 1000 e 9999
            int numeroAleatorio = 1000 + random.nextInt(9000);
            codigoGerado = "PST-" + numeroAleatorio;
            tentativas++;

            if (tentativas > MAX_TENTATIVAS) {
                throw new IllegalStateException(
                    "Limite de tentativas excedido: Não foi possível gerar uma tag única. Espaço numérico saturado."
                );
            }
        } while (tagsExistentes != null && tagsExistentes.contains(codigoGerado));

        return codigoGerado;
    }

    // ========================================================================
    // REGRA DE NEGÓCIO 2: VALIDAÇÃO DO FORMATO DA TAG / MICROCHIP
    // ========================================================================

    /**
     * Valida se uma String digitada ou lida pelo scanner atende ao formato aceito:
     * - Formato PetStory Tag: "PST-" seguido de 4 números (ex: "PST-9921").
     * - Formato Microchip ISO: exatamente 15 dígitos numéricos.
     * 
     * @param codigo Identificador informado pelo veterinário.
     * @return true se o formato for válido; false caso contrário.
     */
    public boolean validarFormatoIdentificador(String codigo) {
        if (codigo == null || codigo.trim().isEmpty()) {
            return false;
        }

        String codigoLimpo = codigo.trim().toUpperCase();
        return PADRAO_TAG_PST.matcher(codigoLimpo).matches() || 
               PADRAO_MICROCHIP.matcher(codigoLimpo).matches();
    }

    // ========================================================================
    // REGRA DE NEGÓCIO 3: GERAÇÃO DE TOKEN OTP DE AUTORIZAÇÃO TEMPORÁRIA
    // ========================================================================

    /**
     * Gera um novo token OTP (One-Time Password) numérico de 6 dígitos
     * associado a um pet, válido por 2 horas para acesso do médico-veterinário.
     * 
     * POR QUE 6 DÍGITOS?
     * É o padrão global de segurança (como tokens de banco e autenticadores Google),
     * pois é rápido e fácil para o tutor ler no app e ditar para a recepção da clínica.
     * 
     * @param petId Identificador do pet autorizado.
     * @return Objeto OtpRegistro com código, timestamp de criação e expiração calculada (+2h).
     */
    public OtpRegistro gerarOtp(String petId) {
        if (petId == null || petId.trim().isEmpty()) {
            throw new IllegalArgumentException("O petId é obrigatório para gerar um token de autorização.");
        }

        // Sorteia número entre 100000 e 999999 (sempre 6 dígitos)
        int numeroOtp = 100000 + random.nextInt(900000);
        String codigoOtp = String.valueOf(numeroOtp);

        return new OtpRegistro(petId, codigoOtp);
    }

    // ========================================================================
    // REGRA DE NEGÓCIO 4: VALIDAÇÃO DE ACESSO COM O TOKEN OTP
    // ========================================================================

    /**
     * Valida se o código digitado pelo médico-veterinário autoriza o acesso ao prontuário.
     * 
     * REGRAS DE SEGURANÇA ANALISADAS:
     * 1. O código digitado não pode ser nulo ou vazio.
     * 2. O código digitado deve coincidir exatamente com o código gerado no app do tutor.
     * 3. O código NÃO pode estar expirado (o horário atual deve ser antes de 'expiraEm').
     * 4. O código NÃO pode ter sido usado anteriormente (evita ataques de repetição).
     * 
     * @param registro Registro do OTP armazenado no sistema/banco.
     * @param codigoDigitado Código informado pelo veterinário na tela.
     * @param momentoAtual Data e hora de referência para a validação (permite testar expiração).
     * @return true se o acesso for autorizado; false se for recusado.
     */
    public boolean validarOtp(OtpRegistro registro, String codigoDigitado, LocalDateTime momentoAtual) {
        // Regra 1: Registro ou código inexistente
        if (registro == null || codigoDigitado == null) {
            return false;
        }

        String codigoLimpo = codigoDigitado.trim().replace(" ", "");

        // Regra 2: Código digitado deve coincidir com o código registrado
        if (!registro.getCodigoOtp().equals(codigoLimpo)) {
            return false;
        }

        // Regra 3: Código já foi consumido anteriormente (uso único)
        if (registro.isJaUsado()) {
            return false;
        }

        // Regra 4: Código expirou (tempo limite de 2 horas ultrapassado)
        if (momentoAtual != null && momentoAtual.isAfter(registro.getExpiraEm())) {
            return false;
        }

        // Se passou em todas as regras, marca como utilizado para garantir uso único
        registro.setJaUsado(true);
        return true;
    }

    /**
     * Sobrecarga do validarOtp que usa automaticamente o horário atual do sistema.
     */
    public boolean validarOtp(OtpRegistro registro, String codigoDigitado) {
        return validarOtp(registro, codigoDigitado, LocalDateTime.now());
    }

    // ========================================================================
    // REGRA DE NEGÓCIO 5: CÁLCULO DE STATUS DA CARTEIRINHA DE VACINAÇÃO
    // ========================================================================

    /**
     * Calcula o status sanitário de uma vacina com base na data prevista para reforço.
     * 
     * REGRAS CLÍNICAS DA CARTEIRINHA PETSTORY:
     * 1. "Atrasada": Se a data de hoje já passou da data de reforço recomendada.
     * 2. "Próximo do Reforço": Se a data de reforço está próxima (faltam 30 dias ou menos).
     * 3. "Em Dia": Se ainda faltam mais de 30 dias para o reforço.
     * 
     * @param dataReforco Data limite do reforço anual/periódico da vacina.
     * @param dataReferencia Data base para cálculo (permite testes unitários precisos).
     * @return String contendo: "Atrasada", "Próximo do Reforço" ou "Em Dia".
     */
    public String calcularStatusVacina(LocalDate dataReforco, LocalDate dataReferencia) {
        if (dataReforco == null) {
            return "Indefinido";
        }
        if (dataReferencia == null) {
            dataReferencia = LocalDate.now();
        }

        // Se a data de referência já passou da data de reforço, a vacina venceu
        if (dataReferencia.isAfter(dataReforco)) {
            return "Atrasada";
        }

        // Calcula quantos dias faltam até o reforço
        long diasRestantes = ChronoUnit.DAYS.between(dataReferencia, dataReforco);

        // Se faltam 30 dias ou menos, acende alerta de reforço próximo
        if (diasRestantes <= 30) {
            return "Próximo do Reforço";
        }

        // Caso contrário, a vacina está 100% em dia
        return "Em Dia";
    }

    /**
     * Sobrecarga do calcularStatusVacina que utiliza a data de hoje do sistema.
     */
    public String calcularStatusVacina(LocalDate dataReforco) {
        return calcularStatusVacina(dataReforco, LocalDate.now());
    }
}
