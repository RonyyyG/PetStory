package br.com.petstory.server;

import br.com.petstory.client.SupabaseRestClient;
import br.com.petstory.service.AuthService;
import br.com.petstory.service.OtpService;
import br.com.petstory.service.PetStoryService;
import br.com.petstory.service.ProntuarioService;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.concurrent.Executors;

/**
 * ============================================================================
 * SERVIDOR HTTP PRINCIPAL: PetStoryHttpServer
 * ============================================================================
 * Servidor HTTP de alta performance e baixo consumo de recursos nativo do Java 21,
 * com suporte a CORS e execução multi-threaded com Virtual Threads.
 *
 * ENDPOINTS DISPONÍVEIS:
 * - GET  /api/health            -> Verificação de integridade e status do servidor
 * - POST /api/auth/login-tutor  -> Autenticação de tutores (validação estrita de senha)
 * - POST /api/auth/login-vet    -> Autenticação de veterinários (validação de CRMV e UF)
 * - POST /api/otp/gerar         -> Geração de código OTP seguro (6 dígitos, 2h de validade)
 * - POST /api/otp/validar       -> Validação e consumo de OTP no atendimento clínico
 * - GET  /api/pets/{id}/prontuario -> Prontuário unificado do animal (Tag PST ou UUID)
 * - POST /api/vacinas           -> Registro de vacinas com assinatura eletrônica CRMV
 * - POST /api/cirurgias         -> Agendamento de cirurgias com reflexo no portal do tutor
 * - POST /api/prescricoes       -> Emissão de prescrições e medicamentos ativos
 */
public class PetStoryHttpServer {

    public static final int PORTA_PADRAO = 8080;

    private final int porta;
    private HttpServer server;
    private final AuthService authService;
    private final OtpService otpService;
    private final ProntuarioService prontuarioService;
    private final SupabaseRestClient supabaseClient;

    public PetStoryHttpServer() {
        this(PORTA_PADRAO);
    }

    public PetStoryHttpServer(int porta) {
        this.porta = porta;
        this.supabaseClient = new SupabaseRestClient();
        this.authService = new AuthService(this.supabaseClient);
        this.otpService = new OtpService(this.supabaseClient);
        PetStoryService petStoryService = new PetStoryService();
        this.prontuarioService = new ProntuarioService(this.supabaseClient, petStoryService);
    }

    public PetStoryHttpServer(int porta, SupabaseRestClient supabaseClient, AuthService authService, OtpService otpService, ProntuarioService prontuarioService) {
        this.porta = porta;
        this.supabaseClient = supabaseClient;
        this.authService = authService;
        this.otpService = otpService;
        this.prontuarioService = prontuarioService;
    }

    /**
     * Inicializa e sobe o servidor HTTP.
     */
    public void start() throws IOException {
        server = HttpServer.create(new InetSocketAddress(porta), 0);

        // Registro de Endpoints REST
        server.createContext("/api/health", new HealthHandler());
        server.createContext("/api/auth/login-tutor", new AuthTutorHandler(authService));
        server.createContext("/api/auth/login-vet", new AuthVetHandler(authService));
        server.createContext("/api/auth/redefinir-senha", new RedefinirSenhaHandler(authService));
        server.createContext("/api/otp/gerar", new OtpGerarHandler(otpService));
        server.createContext("/api/otp/validar", new OtpValidarHandler(otpService));

        // Endpoints Clínicos da PARTE 2
        server.createContext("/api/pets/", new ProntuarioHandler(prontuarioService));
        server.createContext("/api/vacinas", new VacinaPostHandler(prontuarioService));
        server.createContext("/api/cirurgias", new CirurgiaPostHandler(prontuarioService));
        server.createContext("/api/prescricoes", new PrescricaoPostHandler(prontuarioService));

        // Módulo Administrativo: Gestão de Veterinários
        server.createContext("/api/admin/veterinarios", new AdminVetHandler(supabaseClient));

        // Executor com Virtual Threads do Java 21 para escalabilidade
        server.setExecutor(Executors.newVirtualThreadPerTaskExecutor());

        server.start();

        System.out.println("==================================================================");
        System.out.println(" 🐾 PetStory • Backend HTTP Server Ativo (Java 21 LTS)");
        System.out.println("==================================================================");
        System.out.println(" Porta de Escuta:       http://localhost:" + porta);
        System.out.println(" Health Check:          http://localhost:" + porta + "/api/health");
        System.out.println(" Login Tutor:           http://localhost:" + porta + "/api/auth/login-tutor");
        System.out.println(" Login Veterinário:     http://localhost:" + porta + "/api/auth/login-vet");
        System.out.println(" Redefinição de Senha:  http://localhost:" + porta + "/api/auth/redefinir-senha");
        System.out.println(" Gerador de OTP:        http://localhost:" + porta + "/api/otp/gerar");
        System.out.println(" Validador de OTP:      http://localhost:" + porta + "/api/otp/validar");
        System.out.println(" Prontuário Clínico:    http://localhost:" + porta + "/api/pets/{id}/prontuario");
        System.out.println(" Vacinas:               http://localhost:" + porta + "/api/vacinas");
        System.out.println(" Cirurgias:             http://localhost:" + porta + "/api/cirurgias");
        System.out.println(" Prescrições:           http://localhost:" + porta + "/api/prescricoes");
        System.out.println(" Suporte a CORS:        Habilitado (Origem: 127.0.0.1:5500 / *)");
        System.out.println("==================================================================");
    }

    /**
     * Encerra o servidor HTTP.
     */
    public void stop() {
        if (server != null) {
            server.stop(0);
            System.out.println("Servidor PetStory finalizado na porta " + porta);
        }
    }

    public int getPorta() {
        return porta;
    }

    public AuthService getAuthService() {
        return authService;
    }

    public OtpService getOtpService() {
        return otpService;
    }

    public ProntuarioService getProntuarioService() {
        return prontuarioService;
    }

    /**
     * Ponto de entrada para inicialização via terminal / linha de comando.
     * Exemplo: java -cp target/petstory-backend-1.0.0.jar br.com.petstory.server.PetStoryHttpServer
     * Ou via: mvn exec:java -Dexec.mainClass="br.com.petstory.server.PetStoryHttpServer"
     */
    public static void main(String[] args) {
        int porta = PORTA_PADRAO;
        if (args.length > 0) {
            try {
                porta = Integer.parseInt(args[0]);
            } catch (NumberFormatException ignored) {}
        }

        try {
            PetStoryHttpServer server = new PetStoryHttpServer(porta);
            server.start();

            // Adiciona shutdown hook para encerramento gracioso
            Runtime.getRuntime().addShutdownHook(new Thread(server::stop));

        } catch (Exception e) {
            System.err.println("Erro fatal ao iniciar servidor PetStory na porta " + porta + ": " + e.getMessage());
            e.printStackTrace();
        }
    }
}
