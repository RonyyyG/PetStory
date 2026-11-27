package br.com.petstory.service;

import br.com.petstory.model.OtpRegistro;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Random;
import java.util.Set;
import java.util.regex.Pattern;

// Regras puras do sistema (geração de tag sem repetição, validação de OTP e status de vacina)
public class PetStoryService {

    private final Random random;
    private static final Pattern PADRAO_TAG_PST = Pattern.compile("^PST-\\d{4}$");
    private static final Pattern PADRAO_MICROCHIP = Pattern.compile("^\\d{15}$");

    public PetStoryService() {
        this.random = new Random();
    }

    // Construtor com Random injetável para testes determinísticos
    public PetStoryService(Random random) {
        this.random = random;
    }

    // Sorteia PST-XXXX até achar um código livre que ainda não exista no conjunto recebido
    public String gerarCodigoTag(Set<String> tagsExistentes) {
        int tentativas = 0;
        final int MAX_TENTATIVAS = 10000;
        String codigoGerado;

        do {
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

    // Aceita Tag no padrão PST-XXXX ou Microchip ISO com 15 dígitos
    public boolean validarFormatoIdentificador(String codigo) {
        if (codigo == null || codigo.trim().isEmpty()) {
            return false;
        }

        String codigoLimpo = codigo.trim().toUpperCase();
        return PADRAO_TAG_PST.matcher(codigoLimpo).matches() || 
               PADRAO_MICROCHIP.matcher(codigoLimpo).matches();
    }

    // Gera um código numérico de 6 dígitos vinculado ao pet com validade de 2 horas
    public OtpRegistro gerarOtp(String petId) {
        if (petId == null || petId.trim().isEmpty()) {
            throw new IllegalArgumentException("O petId é obrigatório para gerar um token de autorização.");
        }

        int numeroOtp = 100000 + random.nextInt(900000);
        String codigoOtp = String.valueOf(numeroOtp);

        return new OtpRegistro(petId, codigoOtp);
    }

    // Só libera o acesso se o código bater, não tiver sido usado ainda e estiver dentro das 2h; depois já queima o token
    public boolean validarOtp(OtpRegistro registro, String codigoDigitado, LocalDateTime momentoAtual) {
        if (registro == null || codigoDigitado == null) {
            return false;
        }

        String codigoLimpo = codigoDigitado.trim().replace(" ", "");

        if (!registro.getCodigoOtp().equals(codigoLimpo)) {
            return false;
        }

        if (registro.isJaUsado()) {
            return false;
        }

        if (momentoAtual != null && momentoAtual.isAfter(registro.getExpiraEm())) {
            return false;
        }

        registro.setJaUsado(true);
        return true;
    }

    public boolean validarOtp(OtpRegistro registro, String codigoDigitado) {
        return validarOtp(registro, codigoDigitado, LocalDateTime.now());
    }

    // Define o alerta da carteirinha: passou do dia -> Atrasada | até 30 dias -> Próximo do Reforço | acima -> Em Dia
    public String calcularStatusVacina(LocalDate dataReforco, LocalDate dataReferencia) {
        if (dataReforco == null) {
            return "Indefinido";
        }
        if (dataReferencia == null) {
            dataReferencia = LocalDate.now();
        }

        if (dataReferencia.isAfter(dataReforco)) {
            return "Atrasada";
        }

        long diasRestantes = ChronoUnit.DAYS.between(dataReferencia, dataReforco);

        if (diasRestantes <= 30) {
            return "Próximo do Reforço";
        }

        return "Em Dia";
    }

    public String calcularStatusVacina(LocalDate dataReforco) {
        return calcularStatusVacina(dataReforco, LocalDate.now());
    }
}
