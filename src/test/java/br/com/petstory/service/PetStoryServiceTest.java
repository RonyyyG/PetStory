package br.com.petstory.service;

import br.com.petstory.model.OtpRegistro;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

public class PetStoryServiceTest {

    private PetStoryService service;

    /**
     * O método anotado com @BeforeEach é executado automaticamente antes
     * de CADA teste, garantindo que cada teste comece com um serviço limpo.
     */
    @BeforeEach
    public void setup() {
        service = new PetStoryService();
    }

    // ========================================================================
    // TESTE 1: GERAÇÃO DE TAG NO PADRÃO PST-XXXX
    // ========================================================================
    @Test
    @DisplayName("Deve gerar uma tag no padrão correto PST-XXXX")
    public void testGerarCodigoTagFormatoCorreto() {
        // Execução: gera uma nova tag sem nenhuma existente
        String tagGerada = service.gerarCodigoTag(new HashSet<>());

        // Asserções:
        assertNotNull(tagGerada, "A tag gerada não deve ser nula");
        assertTrue(tagGerada.startsWith("PST-"), "A tag deve iniciar com o prefixo 'PST-'");
        assertEquals(8, tagGerada.length(), "A tag 'PST-XXXX' deve ter exatamente 8 caracteres");
        assertTrue(service.validarFormatoIdentificador(tagGerada), "O formato da tag gerada deve ser aceito pelo validador");
    }

    // ========================================================================
    // TESTE 2: TRATAMENTO DE COLISÃO (NUNCA REPETIR UMA TAG EXISTENTE)
    // ========================================================================
    @Test
    @DisplayName("Deve garantir que a tag gerada não colida com tags já cadastradas no banco")
    public void testGerarCodigoTagSemColisao() {
        // Cenário: Simulamos que as tags PST-1000 até PST-1005 já estão no banco de dados
        Set<String> tagsExistentes = new HashSet<>();
        tagsExistentes.add("PST-1000");
        tagsExistentes.add("PST-1001");
        tagsExistentes.add("PST-1002");
        tagsExistentes.add("PST-9921"); // Tag do Thor já cadastrada no Supabase

        // Execução: solicitamos a geração de uma nova tag
        String novaTag = service.gerarCodigoTag(tagsExistentes);

        // Asserção: a nova tag NUNCA pode ser igual a nenhuma das existentes
        assertFalse(tagsExistentes.contains(novaTag), 
            "A nova tag gerada (" + novaTag + ") não pode existir previamente no banco de dados!");
    }

    // ========================================================================
    // TESTE 3: VALIDAÇÃO DE FORMATOS DE TAG E MICROCHIP
    // ========================================================================
    @Test
    @DisplayName("Deve aceitar formatos válidos e rejeitar formatos inválidos de tag")
    public void testValidarIdentificadorValidoEInvalido() {
        // Formatos válidos aceitos pelo sistema
        assertTrue(service.validarFormatoIdentificador("PST-9921"), "PST-9921 deve ser aceito");
        assertTrue(service.validarFormatoIdentificador("PST-4022"), "PST-4022 deve ser aceito");
        assertTrue(service.validarFormatoIdentificador("981098108429182"), "Microchip ISO com 15 dígitos deve ser aceito");

        // Formatos inválidos que devem ser rejeitados
        assertFalse(service.validarFormatoIdentificador("TAG-1234"), "Prefixo incorreto deve ser rejeitado");
        assertFalse(service.validarFormatoIdentificador("PST-ABC"), "Letras onde deveriam ser números devem ser rejeitadas");
        assertFalse(service.validarFormatoIdentificador(""), "String vazia deve ser rejeitada");
        assertFalse(service.validarFormatoIdentificador(null), "Valor nulo deve ser rejeitado");
    }

    // ========================================================================
    // TESTE 4: GERAÇÃO DE TOKEN OTP DE 6 DÍGITOS
    // ========================================================================
    @Test
    @DisplayName("Deve gerar token OTP de 6 dígitos numéricos com validade de 2 horas")
    public void testGerarOtpSeisDigitos() {
        String petId = "pet-thor-uuid";
        OtpRegistro registro = service.gerarOtp(petId);

        // Asserções:
        assertNotNull(registro, "O registro gerado não deve ser nulo");
        assertEquals(petId, registro.getPetId(), "O token deve estar vinculado ao ID do pet correto");
        assertEquals(6, registro.getCodigoOtp().length(), "O código OTP deve ter exatamente 6 dígitos");
        assertFalse(registro.isJaUsado(), "Um código recém-criado não deve estar marcado como usado");
        assertFalse(registro.isExpirado(), "Um código recém-criado não pode estar expirado");
    }

    // ========================================================================
    // TESTE 5: SUCESSO NA VALIDAÇÃO DO TOKEN OTP (ACESSO LIBERADO)
    // ========================================================================
    @Test
    @DisplayName("Deve autorizar acesso clínico quando o veterinário digita o OTP correto")
    public void testValidarOtpComSucesso() {
        // Cenário: Token 849201 gerado há 10 minutos (ainda dentro do prazo de 2h)
        OtpRegistro registro = new OtpRegistro("pet-thor-uuid", "849201");
        registro.setCriadoEm(LocalDateTime.now().minusMinutes(10));
        registro.setExpiraEm(LocalDateTime.now().plusHours(2));

        // Execução: Veterinário digita exatamente "849201"
        boolean autorizado = service.validarOtp(registro, "849201");

        // Asserção: O acesso deve ser permitido
        assertTrue(autorizado, "O código digitado é idêntico ao gerado, logo o acesso deve ser autorizado");
        assertTrue(registro.isJaUsado(), "Após a validação, o registro deve ser marcado como já utilizado (uso único)");
    }

    // ========================================================================
    // TESTE 6: BLOQUEIO QUANDO O VETERINÁRIO DIGITA OTP INCORRETO
    // ========================================================================
    @Test
    @DisplayName("Deve rejeitar acesso quando o veterinário digita código errado")
    public void testBloquearOtpIncorreto() {
        OtpRegistro registro = new OtpRegistro("pet-thor-uuid", "849201");

        // Execução: Veterinário digita um código errado "000000"
        boolean autorizado = service.validarOtp(registro, "000000");

        // Asserção: O acesso deve ser sumariamente bloqueado
        assertFalse(autorizado, "Código incorreto não deve conceder acesso aos dados médicos do pet");
        assertFalse(registro.isJaUsado(), "O token não deve ser consumido se a tentativa foi incorreta");
    }

    // ========================================================================
    // TESTE 7: BLOQUEIO QUANDO O OTP EXPIROU (+ DE 2 HORAS)
    // ========================================================================
    @Test
    @DisplayName("Deve rejeitar acesso quando o código OTP ultrapassou o tempo limite de 2 horas")
    public void testBloquearOtpExpirado() {
        // Cenário: Código válido "849201", mas que expirou há 5 minutos atrás
        OtpRegistro registro = new OtpRegistro("pet-thor-uuid", "849201");
        LocalDateTime dataPassadaExpirada = LocalDateTime.now().minusMinutes(5);
        registro.setExpiraEm(dataPassadaExpirada);

        // Execução: Veterinário digita o código correto, mas tarde demais
        boolean autorizado = service.validarOtp(registro, "849201", LocalDateTime.now());

        // Asserção: Acesso negado por expiração temporal (Segurança LGPD)
        assertFalse(autorizado, "Código expirado há mais de 2 horas não deve ser aceito");
    }

    // ========================================================================
    // TESTE 8: BLOQUEIO DE REUSO DO MESMO OTP (USO ÚNICO)
    // ========================================================================
    @Test
    @DisplayName("Deve impedir que o mesmo código OTP seja reutilizado uma segunda vez")
    public void testBloquearOtpJaUsado() {
        OtpRegistro registro = new OtpRegistro("pet-thor-uuid", "849201");
        
        // Primeira validação: Sucesso
        boolean primeiraVez = service.validarOtp(registro, "849201");
        assertTrue(primeiraVez, "Primeira tentativa deve ser autorizada");

        // Segunda validação com o mesmo código: Deve falhar
        boolean segundaVez = service.validarOtp(registro, "849201");
        assertFalse(segundaVez, "Segunda tentativa com o mesmo token deve ser bloqueada (regra de One-Time Password)");
    }

    // ========================================================================
    // TESTE 9: STATUS DA CARTEIRINHA DE VACINAÇÃO - "EM DIA"
    // ========================================================================
    @Test
    @DisplayName("Deve calcular status 'Em Dia' quando o reforço vence daqui a mais de 30 dias")
    public void testCalcularStatusVacinaEmDia() {
        LocalDate hoje = LocalDate.of(2026, 11, 3);
        // Reforço vence daqui a 6 meses
        LocalDate dataReforco = LocalDate.of(2027, 5, 3);

        String status = service.calcularStatusVacina(dataReforco, hoje);

        assertEquals("Em Dia", status, "Vacina com reforço no próximo ano deve estar 'Em Dia'");
    }

    // ========================================================================
    // TESTE 10: STATUS DA CARTEIRINHA DE VACINAÇÃO - "PRÓXIMO DO REFORÇO"
    // ========================================================================
    @Test
    @DisplayName("Deve calcular status 'Próximo do Reforço' quando faltam 30 dias ou menos")
    public void testCalcularStatusVacinaProximoReforco() {
        LocalDate hoje = LocalDate.of(2026, 11, 3);
        // Reforço vence daqui a 15 dias (18/11/2026)
        LocalDate dataReforco = LocalDate.of(2026, 11, 18);

        String status = service.calcularStatusVacina(dataReforco, hoje);

        assertEquals("Próximo do Reforço", status, "Vacina que vence em menos de 30 dias deve alertar 'Próximo do Reforço'");
    }

    // ========================================================================
    // TESTE 11: STATUS DA CARTEIRINHA DE VACINAÇÃO - "ATRASADA"
    // ========================================================================
    @Test
    @DisplayName("Deve calcular status 'Atrasada' quando a data de reforço já venceu")
    public void testCalcularStatusVacinaAtrasada() {
        LocalDate hoje = LocalDate.of(2026, 11, 3);
        // Reforço venceu mês passado (01/10/2026)
        LocalDate dataReforco = LocalDate.of(2026, 10, 1);

        String status = service.calcularStatusVacina(dataReforco, hoje);

        assertEquals("Atrasada", status, "Vacina com data de reforço no passado deve ser marcada como 'Atrasada'");
    }
}
