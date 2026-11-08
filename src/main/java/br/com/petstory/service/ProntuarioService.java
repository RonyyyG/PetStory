package br.com.petstory.service;

import br.com.petstory.client.SupabaseRestClient;
import br.com.petstory.model.Cirurgia;
import br.com.petstory.model.Prescricao;
import br.com.petstory.model.Vacina;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * ============================================================================
 * SERVIÇO CLÍNICO: ProntuarioService
 * ============================================================================
 * Gerencia o prontuário unificado do animal de forma thread-safe e centralizada:
 * - Histórico de vacinas aplicadas e cálculo dinâmico de status sanitário
 * - Agendamento e registro de cirurgias e procedimentos
 * - Prescrições de medicamentos ativos e descontinuações
 * - Consolidação em tempo real para sincronização imediata entre Médico-Veterinário e Tutor
 */
public class ProntuarioService {

    private final SupabaseRestClient supabaseClient;
    private final PetStoryService petStoryService;

    // Repositórios thread-safe em memória indexados por petId
    private final Map<String, List<Vacina>> vacinasPorPet = new ConcurrentHashMap<>();
    private final Map<String, List<Cirurgia>> cirurgiasPorPet = new ConcurrentHashMap<>();
    private final Map<String, List<Prescricao>> prescricoesPorPet = new ConcurrentHashMap<>();

    // Mapeamento de Tags para Pet IDs
    private final Map<String, String> tagParaPetId = new ConcurrentHashMap<>();

    public static final String THOR_ID = "c810977d-2eea-420e-8957-3ab54afba430";
    public static final String BOLINHA_ID = "7e096a3b-0468-4347-9bee-a8286a10d416";
    public static final String THOR_TAG = "PST-9921";
    public static final String BOLINHA_TAG = "PST-1428";

    public ProntuarioService(SupabaseRestClient supabaseClient, PetStoryService petStoryService) {
        this.supabaseClient = supabaseClient;
        this.petStoryService = petStoryService;

        // Registra mapeamento padrão das tags
        tagParaPetId.put(THOR_TAG, THOR_ID);
        tagParaPetId.put("981098108429182", THOR_ID);
        tagParaPetId.put(BOLINHA_TAG, BOLINHA_ID);
        tagParaPetId.put("PST-4022", "luna-pet-id-4022");

        inicializarDadosIniciais();
    }

    /**
     * Carga inicial semente (seed data) para o paciente de demonstração Thor.
     */
    private void inicializarDadosIniciais() {
        // 1. Vacinas do Thor (4 vacinas históricas)
        List<Vacina> vaxThor = new CopyOnWriteArrayList<>();
        vaxThor.add(criarVacinaModel(
                "vax-thor-01", THOR_ID, "V10 Polivalente Canina",
                LocalDate.of(2025, 11, 15), LocalDate.of(2026, 11, 15),
                "Zoetis • Lote 5849-B2", "Dr. Ricardo (CRMV-SP 38.412)"
        ));
        vaxThor.add(criarVacinaModel(
                "vax-thor-02", THOR_ID, "Antirrábica Defensor",
                LocalDate.of(2026, 1, 10), LocalDate.of(2027, 1, 10),
                "Zoetis • Lote 9012-K4", "Dr. André (CRMV-SP 31.020)"
        ));
        vaxThor.add(criarVacinaModel(
                "vax-thor-03", THOR_ID, "Bronchi-Shield Oral (Gripe Canina)",
                LocalDate.of(2025, 11, 15), LocalDate.of(2026, 11, 15),
                "Boehringer • Lote 7714-X1", "Dr. Ricardo (CRMV-SP 38.412)"
        ));
        vaxThor.add(criarVacinaModel(
                "vax-thor-04", THOR_ID, "Giardiavax (Giárdia)",
                LocalDate.of(2026, 3, 20), LocalDate.of(2027, 3, 20),
                "Zoetis • Lote 3320-G8", "Dra. Camila (CRMV-SP 44.910)"
        ));
        vacinasPorPet.put(THOR_ID, vaxThor);

        // 2. Cirurgias do Thor (Castração concluída)
        List<Cirurgia> cirThor = new CopyOnWriteArrayList<>();
        cirThor.add(new Cirurgia(
                "cir-thor-01", THOR_ID,
                "Orquiectomia Eletiva (Castração) & Implante de Microchip",
                "10/11/2024",
                "Dr. André Villela (CRMV-SP 31.020)",
                "Procedimento sem intercorrências anestésicas. Recuperação pós-cirúrgica excelente.",
                "Concluído"
        ));
        cirurgiasPorPet.put(THOR_ID, cirThor);

        // 3. Prescrições do Thor (Apoquel ativo)
        List<Prescricao> rxThor = new CopyOnWriteArrayList<>();
        rxThor.add(new Prescricao(
                "rx-thor-01", THOR_ID,
                "Apoquel 16mg (Maleato de Oclacitinib)",
                "Uso Contínuo",
                "Controle do prurido e manifestações alérgicas de dermatite atópica",
                "Administrar 1 comprimido por via oral a cada 24 horas, sempre após alimentação matinal",
                "Dra. Camila Fontes (CRMV-SP 44.910)",
                "Ativo"
        ));
        prescricoesPorPet.put(THOR_ID, rxThor);

        // Bolinha começa com listas vazias prontas para receber vacinas e procedimentos em tempo real!
        vacinasPorPet.put(BOLINHA_ID, new CopyOnWriteArrayList<>());
        cirurgiasPorPet.put(BOLINHA_ID, new CopyOnWriteArrayList<>());
        prescricoesPorPet.put(BOLINHA_ID, new CopyOnWriteArrayList<>());
    }

    private Vacina criarVacinaModel(String id, String petId, String nome, LocalDate apl, LocalDate ref, String lote, String vet) {
        Vacina v = new Vacina(id, petId, nome, apl, ref, lote, vet);
        v.setStatus(petStoryService.calcularStatusVacina(ref));
        return v;
    }

    /**
     * Resolve o identificador do pet aceitando tanto o ID (UUID) quanto a Tag PST ou nome.
     */
    public String resolverPetId(String idOuTag) {
        if (idOuTag == null || idOuTag.trim().isEmpty()) {
            return BOLINHA_ID;
        }
        String clean = idOuTag.trim();
        String upper = clean.toUpperCase();

        if (tagParaPetId.containsKey(upper)) {
            return tagParaPetId.get(upper);
        }
        if ("BOLINHA".equalsIgnoreCase(clean) || BOLINHA_TAG.equalsIgnoreCase(clean)) {
            return BOLINHA_ID;
        }
        if ("THOR".equalsIgnoreCase(clean) || THOR_TAG.equalsIgnoreCase(clean)) {
            return THOR_ID;
        }

        // Se parecer uma Tag ou identificador, consulta Supabase
        if (upper.startsWith("PST-") || upper.length() == 15) {
            JsonObject tagObj = supabaseClient.buscarTagPorCodigo(upper);
            if (tagObj != null && tagObj.has("pet_id")) {
                String pid = tagObj.get("pet_id").getAsString();
                tagParaPetId.put(upper, pid);
                return pid;
            }
        }

        // Se já for o próprio UUID ou petId
        return clean;
    }

    /**
     * Registra uma nova vacina, persiste no banco Supabase PostgreSQL e atualiza seu status sanitário.
     */
    public Vacina adicionarVacina(String idOuTag, Vacina vacina) {
        if (vacina == null) {
            throw new IllegalArgumentException("Dados da vacina não podem ser nulos.");
        }
        if (vacina.getNomeVacina() == null || vacina.getNomeVacina().trim().isEmpty()) {
            throw new IllegalArgumentException("O nome da vacina é obrigatório.");
        }

        String petId = resolverPetId(idOuTag);
        vacina.setPetId(petId);

        if (vacina.getId() == null || vacina.getId().trim().isEmpty()) {
            vacina.setId("vax-" + UUID.randomUUID().toString());
        }
        if (vacina.getDataAplicacao() == null) {
            vacina.setDataAplicacao(LocalDate.now());
        }
        if (vacina.getDataReforco() == null) {
            vacina.setDataReforco(vacina.getDataAplicacao().plusYears(1));
        }
        if (vacina.getLoteFabricante() == null || vacina.getLoteFabricante().trim().isEmpty()) {
            vacina.setLoteFabricante("Lote Padrão");
        }
        if (vacina.getVeterinarioResponsavel() == null || vacina.getVeterinarioResponsavel().trim().isEmpty()) {
            vacina.setVeterinarioResponsavel("Dr. Ricardo Mendonça (CRMV-SP 38.412)");
        }

        // Calcula o status sanitário real via regra de negócio
        vacina.setStatus(petStoryService.calcularStatusVacina(vacina.getDataReforco()));

        // Se a lista do pet em memória estiver vazia, sincroniza com o histórico do banco antes de adicionar
        List<Vacina> lista = vacinasPorPet.computeIfAbsent(petId, k -> new CopyOnWriteArrayList<>());
        if (lista.isEmpty()) {
            carregarVacinasDoBanco(petId, lista);
        }

        // Persiste no banco de dados relacional Supabase PostgreSQL em tempo real
        try {
            JsonObject salvoDb = supabaseClient.salvarVacinaNoBanco(petId, vacina);
            if (salvoDb != null && salvoDb.has("id") && !salvoDb.get("id").isJsonNull()) {
                vacina.setId(salvoDb.get("id").getAsString());
            }
        } catch (Exception e) {
            System.err.println("[ProntuarioService] Aviso ao persistir vacina no Supabase: " + e.getMessage());
        }

        // Insere na lista do pet (no início, para ordem cronológica decrescente)
        lista.add(0, vacina);

        System.out.println("[ProntuarioService] Vacina registrada com sucesso para o pet " + petId + ": " + vacina.getNomeVacina());
        return vacina;
    }

    /**
     * Retorna a lista atualizada de vacinas do pet com status recalculado.
     * Caso o cache em memória para o pet esteja vazio, consulta o banco Supabase
     * PostgreSQL em tempo real para carregar o histórico vacinal do animal.
     */
    public List<Vacina> listarVacinas(String idOuTag) {
        String petId = resolverPetId(idOuTag);
        List<Vacina> lista = vacinasPorPet.computeIfAbsent(petId, k -> new CopyOnWriteArrayList<>());

        // Se a lista em memória estiver vazia, carrega as vacinas reais persistidas no Supabase
        if (lista.isEmpty()) {
            carregarVacinasDoBanco(petId, lista);
        }

        for (Vacina v : lista) {
            v.setStatus(petStoryService.calcularStatusVacina(v.getDataReforco()));
        }
        return Collections.unmodifiableList(lista);
    }

    /**
     * Sincroniza e popula a lista de vacinas de um pet a partir da tabela 'vacinas' do Supabase.
     */
    private void carregarVacinasDoBanco(String petId, List<Vacina> destino) {
        try {
            List<JsonObject> vacinasDb = supabaseClient.buscarVacinasPorPetId(petId);
            if (vacinasDb != null && !vacinasDb.isEmpty()) {
                for (JsonObject obj : vacinasDb) {
                    Vacina v = converterJsonParaVacina(obj, petId);
                    if (v != null) {
                        destino.add(v);
                    }
                }
                System.out.println("[ProntuarioService] " + destino.size() + " vacina(s) carregada(s) do Supabase para o pet " + petId);
            }
        } catch (Exception e) {
            System.err.println("[ProntuarioService] Aviso ao carregar vacinas do banco para o pet " + petId + ": " + e.getMessage());
        }
    }

    /**
     * Converte um registro JsonObject retornado pelo Supabase no modelo de domínio Vacina.
     */
    private Vacina converterJsonParaVacina(JsonObject obj, String fallbackPetId) {
        if (obj == null) return null;
        try {
            String id = obj.has("id") && !obj.get("id").isJsonNull() ? obj.get("id").getAsString() : "vax-" + UUID.randomUUID();
            String petId = obj.has("pet_id") && !obj.get("pet_id").isJsonNull() ? obj.get("pet_id").getAsString() : fallbackPetId;
            String nome = obj.has("nome_vacina") && !obj.get("nome_vacina").isJsonNull() ? obj.get("nome_vacina").getAsString() :
                         (obj.has("nome") && !obj.get("nome").isJsonNull() ? obj.get("nome").getAsString() : "Vacina");
            String lote = obj.has("laboratorio_lote") && !obj.get("laboratorio_lote").isJsonNull() ? obj.get("laboratorio_lote").getAsString() :
                         (obj.has("lote") && !obj.get("lote").isJsonNull() ? obj.get("lote").getAsString() : "Lote Padrão");
            String vet = obj.has("veterinario_crmv") && !obj.get("veterinario_crmv").isJsonNull() ? obj.get("veterinario_crmv").getAsString() :
                        (obj.has("veterinarioResponsavel") && !obj.get("veterinarioResponsavel").isJsonNull() ? obj.get("veterinarioResponsavel").getAsString() : "CRMV-SP 38.412");

            LocalDate apl = null;
            if (obj.has("data_aplicacao") && !obj.get("data_aplicacao").isJsonNull()) {
                apl = LocalDate.parse(obj.get("data_aplicacao").getAsString().substring(0, 10));
            } else if (obj.has("dataAplicacao") && !obj.get("dataAplicacao").isJsonNull()) {
                apl = LocalDate.parse(obj.get("dataAplicacao").getAsString().substring(0, 10));
            } else {
                apl = LocalDate.now();
            }

            LocalDate ref = null;
            if (obj.has("data_reforco") && !obj.get("data_reforco").isJsonNull()) {
                ref = LocalDate.parse(obj.get("data_reforco").getAsString().substring(0, 10));
            } else if (obj.has("dataReforco") && !obj.get("dataReforco").isJsonNull()) {
                ref = LocalDate.parse(obj.get("dataReforco").getAsString().substring(0, 10));
            } else {
                ref = apl.plusYears(1);
            }

            Vacina v = new Vacina(id, petId, nome, apl, ref, lote, vet);
            v.setStatus(petStoryService.calcularStatusVacina(ref));
            return v;
        } catch (Exception e) {
            System.err.println("[ProntuarioService] Erro ao converter JSON de vacina: " + e.getMessage());
            return null;
        }
    }

    /**
     * Registra uma nova cirurgia ou procedimento no prontuário.
     */
    public Cirurgia adicionarCirurgia(String idOuTag, Cirurgia cirurgia) {
        if (cirurgia == null) {
            throw new IllegalArgumentException("Dados da cirurgia não podem ser nulos.");
        }
        if (cirurgia.getNome() == null || cirurgia.getNome().trim().isEmpty()) {
            throw new IllegalArgumentException("O nome do procedimento/cirurgia é obrigatório.");
        }

        String petId = resolverPetId(idOuTag);
        cirurgia.setPetId(petId);

        if (cirurgia.getId() == null || cirurgia.getId().trim().isEmpty()) {
            cirurgia.setId("cir-" + UUID.randomUUID().toString());
        }
        if (cirurgia.getData() == null || cirurgia.getData().trim().isEmpty()) {
            cirurgia.setData(LocalDate.now().plusMonths(1).format(DateTimeFormatter.ofPattern("dd/MM/yyyy")));
        }
        if (cirurgia.getCirurgiao() == null || cirurgia.getCirurgiao().trim().isEmpty()) {
            cirurgia.setCirurgiao("Dr. Ricardo Mendonça (CRMV-SP 38.412)");
        }
        if (cirurgia.getStatus() == null || cirurgia.getStatus().trim().isEmpty()) {
            cirurgia.setStatus("Agendada");
        }

        List<Cirurgia> lista = cirurgiasPorPet.computeIfAbsent(petId, k -> new CopyOnWriteArrayList<>());
        lista.add(0, cirurgia);

        System.out.println("[ProntuarioService] Cirurgia registrada para o pet " + petId + ": " + cirurgia.getNome());
        return cirurgia;
    }

    /**
     * Retorna todas as cirurgias do pet.
     */
    public List<Cirurgia> listarCirurgias(String idOuTag) {
        String petId = resolverPetId(idOuTag);
        return Collections.unmodifiableList(cirurgiasPorPet.computeIfAbsent(petId, k -> new CopyOnWriteArrayList<>()));
    }

    /**
     * Registra uma nova prescrição médica vinculada ao pet.
     */
    public Prescricao adicionarPrescricao(String idOuTag, Prescricao prescricao) {
        if (prescricao == null) {
            throw new IllegalArgumentException("Dados da prescrição não podem ser nulos.");
        }
        if (prescricao.getNome() == null || prescricao.getNome().trim().isEmpty()) {
            throw new IllegalArgumentException("O nome do medicamento é obrigatório.");
        }

        String petId = resolverPetId(idOuTag);
        prescricao.setPetId(petId);

        if (prescricao.getId() == null || prescricao.getId().trim().isEmpty()) {
            prescricao.setId("rx-" + UUID.randomUUID().toString());
        }
        if (prescricao.getVeterinario() == null || prescricao.getVeterinario().trim().isEmpty()) {
            prescricao.setVeterinario("Dr. Ricardo Mendonça (CRMV-SP 38.412)");
        }
        if (prescricao.getStatus() == null || prescricao.getStatus().trim().isEmpty()) {
            prescricao.setStatus("Ativo");
        }

        List<Prescricao> lista = prescricoesPorPet.computeIfAbsent(petId, k -> new CopyOnWriteArrayList<>());
        lista.add(0, prescricao);

        System.out.println("[ProntuarioService] Prescrição adicionada para o pet " + petId + ": " + prescricao.getNome());
        return prescricao;
    }

    /**
     * Retorna as prescrições médicas do pet.
     */
    public List<Prescricao> listarPrescricoes(String idOuTag) {
        String petId = resolverPetId(idOuTag);
        return Collections.unmodifiableList(prescricoesPorPet.computeIfAbsent(petId, k -> new CopyOnWriteArrayList<>()));
    }

    /**
     * Suspende uma prescrição médica (interrupção do tratamento).
     */
    public boolean suspenderPrescricao(String idOuTag, String prescricaoId) {
        String petId = resolverPetId(idOuTag);
        List<Prescricao> lista = prescricoesPorPet.get(petId);
        if (lista != null) {
            for (Prescricao rx : lista) {
                if (rx.getId().equals(prescricaoId) || rx.getNome().contains(prescricaoId)) {
                    rx.setStatus("Suspenso");
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Consolida e retorna o prontuário completo do pet.
     * Inclui: dados cadastrais, tutor, vacinas com status sanitário, cirurgias agendadas,
     * prescrições ativas e lembretes sanitários consolidados para o Portal do Tutor.
     */
    public JsonObject obterProntuarioCompleto(String idOuTag) {
        String petId = resolverPetId(idOuTag);

        // 1. Dados cadastrais do animal (Supabase com fallback)
        JsonObject petJson = supabaseClient.buscarPetPorId(petId);
        if (petJson == null) {
            petJson = new JsonObject();
            petJson.addProperty("id", petId);
            if (THOR_ID.equals(petId)) {
                petJson.addProperty("nome", "Thor");
                petJson.addProperty("especie", "Canina");
                petJson.addProperty("raca", "Golden Retriever");
                petJson.addProperty("peso", 32.8);
                petJson.addProperty("sexo", "Macho - Castrado");
                petJson.addProperty("alergias_graves", "Dipirona e Sulfas (Choque anafilático prévio)");
                petJson.addProperty("tutor_id", "1d41b141-75a1-4ea8-b398-4c5ff5ece979");
            } else {
                petJson.addProperty("nome", "Bolinha");
                petJson.addProperty("especie", "Canina");
                petJson.addProperty("raca", "SRD");
                petJson.addProperty("peso", 12.5);
                petJson.addProperty("sexo", "Macho");
                petJson.addProperty("alergias_graves", "Ração Pedegree, Dipirona");
                petJson.addProperty("tutor_id", "e99ad1d0-8fa3-43ca-9fba-e96832dc231f");
            }
        }

        // Tag associada ao pet
        String tag = supabaseClient.buscarTagPorPetId(petId);
        if (tag == null || tag.isEmpty()) {
            tag = THOR_ID.equals(petId) ? THOR_TAG : BOLINHA_TAG;
        }
        petJson.addProperty("tag", tag);
        petJson.addProperty("codigo_tag", tag);

        // 2. Dados cadastrais do Tutor responsável
        String tutorId = petJson.has("tutor_id") ? petJson.get("tutor_id").getAsString() : null;
        JsonObject tutorJson = tutorId != null ? supabaseClient.buscarTutorPorId(tutorId) : null;
        if (tutorJson == null) {
            tutorJson = new JsonObject();
            if (THOR_ID.equals(petId)) {
                tutorJson.addProperty("id", "1d41b141-75a1-4ea8-b398-4c5ff5ece979");
                tutorJson.addProperty("nome", "Mariana Vasconcelos");
                tutorJson.addProperty("email", "mariana@email.com");
                tutorJson.addProperty("telefone_emergencia", "(11) 98765-4321");
                tutorJson.addProperty("cidade", "São Paulo - SP");
            } else {
                tutorJson.addProperty("id", "e99ad1d0-8fa3-43ca-9fba-e96832dc231f");
                tutorJson.addProperty("nome", "Rafael Martins Oliveira");
                tutorJson.addProperty("email", "rafael.teste@example.com");
                tutorJson.addProperty("telefone_emergencia", "(00) 90000-1234");
                tutorJson.addProperty("cidade", "Caruaru - PE");
            }
        }

        // 3. Monta listas de Vacinas
        List<Vacina> listaVax = listarVacinas(petId);
        JsonArray arrayVax = new JsonArray();
        for (Vacina v : listaVax) {
            JsonObject vObj = new JsonObject();
            vObj.addProperty("id", v.getId());
            vObj.addProperty("pet_id", v.getPetId());
            vObj.addProperty("nome", v.getNomeVacina());
            vObj.addProperty("nome_vacina", v.getNomeVacina());
            vObj.addProperty("lote", v.getLoteFabricante());
            vObj.addProperty("laboratorio_lote", v.getLoteFabricante());
            vObj.addProperty("data_aplicacao", v.getDataAplicacao() != null ? v.getDataAplicacao().toString() : null);
            vObj.addProperty("data_reforco", v.getDataReforco() != null ? v.getDataReforco().toString() : null);
            vObj.addProperty("dataAplicacao", v.getDataAplicacao() != null ? v.getDataAplicacao().toString() : null);
            vObj.addProperty("dataReforco", v.getDataReforco() != null ? v.getDataReforco().toString() : null);
            vObj.addProperty("veterinario_crmv", v.getVeterinarioResponsavel());
            vObj.addProperty("veterinarioResponsavel", v.getVeterinarioResponsavel());
            vObj.addProperty("status", v.getStatus());
            arrayVax.add(vObj);
        }

        // 4. Monta listas de Cirurgias
        List<Cirurgia> listaCir = listarCirurgias(petId);
        JsonArray arrayCir = new JsonArray();
        for (Cirurgia c : listaCir) {
            JsonObject cObj = new JsonObject();
            cObj.addProperty("id", c.getId());
            cObj.addProperty("pet_id", c.getPetId());
            cObj.addProperty("nome", c.getNome());
            cObj.addProperty("data", c.getData());
            cObj.addProperty("cirurgiao", c.getCirurgiao());
            cObj.addProperty("notas", c.getNotas());
            cObj.addProperty("status", c.getStatus());
            arrayCir.add(cObj);
        }

        // 5. Monta listas de Prescrições
        List<Prescricao> listaRx = listarPrescricoes(petId);
        JsonArray arrayRx = new JsonArray();
        for (Prescricao rx : listaRx) {
            JsonObject rxObj = new JsonObject();
            rxObj.addProperty("id", rx.getId());
            rxObj.addProperty("pet_id", rx.getPetId());
            rxObj.addProperty("nome", rx.getNome());
            rxObj.addProperty("tipo", rx.getTipo());
            rxObj.addProperty("indicacao", rx.getIndicacao());
            rxObj.addProperty("posologia", rx.getPosologia());
            rxObj.addProperty("veterinario", rx.getVeterinario());
            rxObj.addProperty("status", rx.getStatus());
            arrayRx.add(rxObj);
        }

        // 6. Monta Lembretes Inteligentes para o Portal do Tutor
        JsonArray arrayLembretes = new JsonArray();

        // 6.1 Cirurgias e Procedimentos Agendados
        for (Cirurgia c : listaCir) {
            if ("Agendada".equalsIgnoreCase(c.getStatus())) {
                JsonObject lembrete = new JsonObject();
                lembrete.addProperty("tipo", "cirurgia");
                lembrete.addProperty("titulo", c.getNome() + " (Cirurgia Agendada)");
                lembrete.addProperty("data", c.getData());
                lembrete.addProperty("responsavel", c.getCirurgiao());
                lembrete.addProperty("detalhe", c.getNotas() != null ? c.getNotas() : "Jejum e preparo obrigatório");
                lembrete.addProperty("badge", "Agendada");
                arrayLembretes.add(lembrete);
            }
        }

        // 6.2 Próximos Reforços de Vacinas
        for (Vacina v : listaVax) {
            if (v.getDataReforco() != null) {
                JsonObject lembrete = new JsonObject();
                lembrete.addProperty("tipo", "vacina");
                lembrete.addProperty("titulo", "Reforço " + v.getNomeVacina());
                // Formata data de reforço no padrão DD/MM/AAAA
                String refFormatada = v.getDataReforco().format(DateTimeFormatter.ofPattern("dd/MM/yyyy"));
                lembrete.addProperty("data", refFormatada);
                lembrete.addProperty("responsavel", v.getVeterinarioResponsavel());
                lembrete.addProperty("detalhe", "Lote: " + v.getLoteFabricante());
                lembrete.addProperty("badge", v.getStatus());
                arrayLembretes.add(lembrete);
            }
        }

        // 7. Consolida Resposta Geral
        JsonObject prontuario = new JsonObject();
        prontuario.addProperty("sucesso", true);
        prontuario.add("pet", petJson);
        prontuario.add("tutor", tutorJson);
        prontuario.add("vacinas", arrayVax);
        prontuario.add("cirurgias", arrayCir);
        prontuario.add("prescricoes", arrayRx);
        prontuario.add("lembretes", arrayLembretes);

        return prontuario;
    }
}
