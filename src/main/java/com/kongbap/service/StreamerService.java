package com.kongbap.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.kongbap.domain.Streamer;
import com.kongbap.domain.Video;
import com.kongbap.dto.StreamerDto;
import com.kongbap.dto.VideoDto;
import com.kongbap.repository.StreamerRepository;
import com.kongbap.repository.VideoRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.concurrent.locks.ReentrantLock;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class StreamerService {

    private final StreamerRepository streamerRepository;
    private final VideoRepository videoRepository;
    private final ObjectMapper objectMapper;
    private final TransactionTemplate transactionTemplate;
    private final ReentrantLock syncLock = new ReentrantLock();

    public List<StreamerDto> getAllStreamers() {
        return streamerRepository.findAllByOrderByDisplayOrderAscIdAsc().stream()
                .map(StreamerDto::fromEntity)
                .toList();
    }

    public List<StreamerDto> getStreamersByCategory(String category) {
        return streamerRepository.findByCategoryOrderByDisplayOrderAscIdAsc(category).stream()
                .map(StreamerDto::fromEntity)
                .toList();
    }

    public Optional<StreamerDto> getStreamer(String idOrCustomId) {
        return findStreamerEntity(idOrCustomId).map(StreamerDto::fromEntity);
    }

    public StreamerDto saveStreamer(StreamerDto dto) {
        syncLock.lock();
        StreamerDto result;
        try {
            result = transactionTemplate.execute(status -> doSaveStreamer(dto));
        } finally {
            syncLock.unlock();
        }
        return result;
    }

    private StreamerDto doSaveStreamer(StreamerDto dto) {
        Streamer streamer = null;
        if (dto.getId() != null && !dto.getId().isBlank()) {
            streamer = findStreamerEntity(dto.getId()).orElse(null);
        }

        if (streamer == null) {
            String customId = (dto.getId() != null && !dto.getId().isBlank())
                    ? dto.getId()
                    : "m-" + System.currentTimeMillis();
            streamer = Streamer.builder()
                    .customId(customId)
                    .build();
        }

        streamer.setName(dto.getName());
        streamer.setStreamer(dto.getStreamer());
        streamer.setCategory(dto.getCategory());
        streamer.setSubgroup(dto.getSubgroup());
        streamer.setRole(dto.getRole());
        streamer.setSwatRole(dto.getSwatRole());
        streamer.setBadgeColor(dto.getBadgeColor());
        streamer.setStatus(dto.getStatus());
        streamer.setAvatar(dto.getAvatar());
        streamer.setAffiliations(dto.getAffiliations());
        if (dto.getDisplayOrder() != null) {
            streamer.setDisplayOrder(dto.getDisplayOrder());
        }
        if (dto.getSubscriberCount() != null) {
            streamer.setSubscriberCount(dto.getSubscriberCount());
        }
        if (dto.getYoutubeUrl() != null) {
            streamer.setYoutubeUrl(dto.getYoutubeUrl());
        }

        Streamer saved = streamerRepository.save(streamer);
        return StreamerDto.fromEntity(saved);
    }

    @Transactional
    public boolean deleteStreamer(String idOrCustomId) {
        Optional<Streamer> opt = findStreamerEntity(idOrCustomId);
        if (opt.isPresent()) {
            streamerRepository.delete(opt.get());
            exportStaticJson();
            return true;
        }
        return false;
    }

    @Transactional
    public VideoDto saveVideo(String streamerIdOrCustomId, VideoDto dto) {
        Streamer streamer = findStreamerEntity(streamerIdOrCustomId)
                .orElseThrow(() -> new IllegalArgumentException("해당 스트리머를 찾을 수 없습니다: " + streamerIdOrCustomId));

        Video video = null;
        if (dto.getId() != null && !dto.getId().isBlank()) {
            video = findVideoEntity(dto.getId()).orElse(null);
        }

        if (video == null) {
            String customId = (dto.getId() != null && !dto.getId().isBlank())
                    ? dto.getId()
                    : "v-" + System.currentTimeMillis();
            video = Video.builder()
                    .customId(customId)
                    .streamer(streamer)
                    .build();
        }

        video.setTitle(dto.getTitle());
        video.setUrl(dto.getUrl());
        video.setVideoType(dto.getVideoType() != null ? dto.getVideoType() : "clip");
        video.setDate(dto.getDate());
        video.setDuration(dto.getDuration());
        video.setDescription(dto.getDescription());
        video.setThumbnailUrl(dto.getThumbnailUrl());
        if (dto.getDisplayOrder() != null) {
            video.setDisplayOrder(dto.getDisplayOrder());
        }
        video.setViewCount(dto.getViewCount());

        Video saved = videoRepository.save(video);
        VideoDto result = VideoDto.fromEntity(saved);
        exportStaticJson();
        return result;
    }

    @Transactional
    public boolean deleteVideo(String videoIdOrCustomId) {
        Optional<Video> opt = findVideoEntity(videoIdOrCustomId);
        if (opt.isPresent()) {
            Video video = opt.get();
            Streamer streamer = video.getStreamer();
            if (streamer != null && streamer.getVideos() != null) {
                streamer.getVideos().remove(video);
                for (int i = 0; i < streamer.getVideos().size(); i++) {
                    streamer.getVideos().get(i).setDisplayOrder(i);
                }
            }
            videoRepository.delete(video);
            exportStaticJson();
            return true;
        }
        return false;
    }

    @Transactional
    public boolean deleteAllVideosByStreamer(String streamerIdOrCustomId) {
        Optional<Streamer> opt = findStreamerEntity(streamerIdOrCustomId);
        if (opt.isPresent()) {
            Streamer streamer = opt.get();
            if (streamer.getVideos() != null && !streamer.getVideos().isEmpty()) {
                streamer.getVideos().clear();
                streamerRepository.save(streamer);
                exportStaticJson();
                return true;
            }
        }
        return false;
    }

    public List<StreamerDto> syncStreamers(List<StreamerDto> dtoList) {
        if (dtoList == null || dtoList.isEmpty()) {
            return Collections.emptyList();
        }

        syncLock.lock();
        List<StreamerDto> results;
        try {
            results = transactionTemplate.execute(status -> doSyncStreamers(dtoList));
        } finally {
            syncLock.unlock();
        }
        exportStaticJson();
        return results != null ? results : Collections.emptyList();
    }

    private List<StreamerDto> doSyncStreamers(List<StreamerDto> dtoList) {
        // 기존 스트리머 전체와 비디오 목록을 1번의 쿼리로 일괄 조회 (N+1 SELECT 및 잦은 Auto-Flush 방지)
        List<Streamer> allExisting = streamerRepository.findAllByOrderByDisplayOrderAscIdAsc();
        Map<String, Streamer> customIdMap = new HashMap<>(allExisting.size() * 2);
        Map<Long, Streamer> idMap = new HashMap<>(allExisting.size() * 2);
        for (Streamer s : allExisting) {
            if (s.getCustomId() != null) {
                customIdMap.put(s.getCustomId(), s);
            }
            if (s.getId() != null) {
                idMap.put(s.getId(), s);
            }
        }

        List<Streamer> toSave = new ArrayList<>(dtoList.size());
        int order = 0;
        for (StreamerDto dto : dtoList) {
            if (dto.getDisplayOrder() == null) {
                dto.setDisplayOrder(order++);
            }
            Streamer streamer = null;
            if (dto.getId() != null && !dto.getId().isBlank()) {
                streamer = customIdMap.get(dto.getId());
                if (streamer == null) {
                    try {
                        Long numId = Long.parseLong(dto.getId());
                        streamer = idMap.get(numId);
                    } catch (NumberFormatException ignored) {
                    }
                }
            }

            if (streamer == null) {
                String customId = (dto.getId() != null && !dto.getId().isBlank())
                        ? dto.getId()
                        : "m-" + System.currentTimeMillis();
                streamer = Streamer.builder()
                        .customId(customId)
                        .build();
                customIdMap.put(customId, streamer);
            }

            streamer.setName(dto.getName());
            streamer.setStreamer(dto.getStreamer());
            streamer.setCategory(dto.getCategory());
            streamer.setSubgroup(dto.getSubgroup());
            streamer.setRole(dto.getRole());
            streamer.setSwatRole(dto.getSwatRole());
            streamer.setBadgeColor(dto.getBadgeColor());
            if (dto.getStatus() != null) {
                streamer.setStatus(dto.getStatus());
            }
            streamer.setAvatar(dto.getAvatar());
            streamer.setAffiliations(dto.getAffiliations());
            streamer.setDisplayOrder(dto.getDisplayOrder());
            if (dto.getSubscriberCount() != null) {
                streamer.setSubscriberCount(dto.getSubscriberCount());
            }
            if (dto.getYoutubeUrl() != null) {
                streamer.setYoutubeUrl(dto.getYoutubeUrl());
            }

            // 영상 목록이 전달된 경우에만 동기화 수행 (빈 배열이나 null인 경우 기존 DB 영상을 절대 삭제하지 않도록 보호)
            if (dto.getVideos() != null && !dto.getVideos().isEmpty()) {
                List<Video> currentVideos = streamer.getVideos();
                if (currentVideos == null) {
                    currentVideos = new ArrayList<>();
                    streamer.setVideos(currentVideos);
                }

                Map<String, Video> existingVideosMap = new HashMap<>();
                for (Video v : currentVideos) {
                    if (v.getCustomId() != null) {
                        existingVideosMap.put(v.getCustomId(), v);
                    }
                }

                Set<Video> keptVideos = new HashSet<>();
                int vOrder = 0;
                for (VideoDto vDto : dto.getVideos()) {
                    Video v = (vDto.getId() != null) ? existingVideosMap.get(vDto.getId()) : null;
                    if (v == null) {
                        String vCustomId = (vDto.getId() != null && !vDto.getId().isBlank())
                                ? vDto.getId()
                                : "v-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 6);
                        v = Video.builder()
                                .customId(vCustomId)
                                .streamer(streamer)
                                .build();
                        currentVideos.add(v);
                    }
                    v.setTitle(vDto.getTitle());
                    v.setUrl(vDto.getUrl());
                    v.setVideoType(vDto.getVideoType() != null ? vDto.getVideoType() : "clip");
                    v.setDate(vDto.getDate());
                    v.setDuration(vDto.getDuration());
                    v.setDescription(vDto.getDescription());
                    v.setThumbnailUrl(vDto.getThumbnailUrl());
                    v.setDisplayOrder(vDto.getDisplayOrder() != null ? vDto.getDisplayOrder() : vOrder++);
                    v.setViewCount(vDto.getViewCount());
                    v.setStreamer(streamer);
                    keptVideos.add(v);
                }

                // DTO에 없는 기존 영상은 orphanRemoval로 자동 삭제되도록 컬렉션에서 제거
                currentVideos.removeIf(v -> !keptVideos.contains(v));
            }

            toSave.add(streamer);
        }

        List<Streamer> savedList = streamerRepository.saveAll(toSave);
        streamerRepository.flush();
        List<StreamerDto> results = new ArrayList<>(savedList.size());
        for (Streamer saved : savedList) {
            results.add(StreamerDto.fromEntity(saved));
        }

        return results;
    }

    public void exportStaticJson() {
        try {
            String json = null;
            Path backupPath = Paths.get("D:", "\uBC31\uC5C5 \uD30C\uC77C", "KONGBAP_BACKUPS_JSON", "backup.json");
            if (Files.exists(backupPath)) {
                try {
                    String backupContent = Files.readString(backupPath, StandardCharsets.UTF_8);
                    if (backupContent != null && backupContent.contains("\"categories\"") && (backupContent.contains("gang-goldmoon") || backupContent.length() > 500000)) {
                        json = backupContent;
                    }
                } catch (Exception ignored) {}
            }

            if (json == null) {
                Path staticPath = Paths.get("src", "main", "resources", "static", "streamers.json");
                if (Files.exists(staticPath)) {
                    try {
                        json = Files.readString(staticPath, StandardCharsets.UTF_8);
                    } catch (Exception ignored) {}
                }
            }

            if (json == null) {
                List<StreamerDto> all = getAllStreamers();
                json = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(all);
            }

            // static 및 docs, build 폴더의 streamers.json 동시 갱신
            List<Path> targets = List.of(
                    Paths.get("src", "main", "resources", "static", "streamers.json"),
                    Paths.get("build", "resources", "main", "static", "streamers.json"),
                    Paths.get("docs", "streamers.json")
            );
            for (Path p : targets) {
                try {
                    if (Files.exists(p.getParent())) {
                        Files.writeString(p, json, StandardCharsets.UTF_8);
                    }
                } catch (Exception ignored) {}
            }

            log.info("정적 streamers.json 자동 갱신 완료");
        } catch (Exception e) {
            log.error("streamers.json 저장 실패", e);
        }
    }

    @org.springframework.context.event.EventListener(org.springframework.boot.context.event.ApplicationReadyEvent.class)
    @Transactional
    public void initStreamersIfMissing() {
        try {
            long count = streamerRepository.count();
            log.info("현재 DB 등록 스트리머 수: {}명", count);
            if (count > 0) {
                log.info("MariaDB에 이미 {}명의 스트리머 데이터가 보존되어 있어 초기 시딩을 건너뜁니다. (데이터 보존)", count);
                return;
            }

            // DB가 비어있는 경우에만 최신 backup.json 또는 정적 streamers.json에서 초기 시딩 수행
            Path backupPath = Paths.get("D:", "\uBC31\uC5C5 \uD30C\uC77C", "KONGBAP_BACKUPS_JSON", "backup.json");
            String content = null;
            if (Files.exists(backupPath)) {
                try {
                    content = Files.readString(backupPath, StandardCharsets.UTF_8);
                    log.info("최신 backup.json 파일로부터 초기 DB 시딩을 시도합니다.");
                } catch (Exception ignored) {}
            }

            if (content == null || content.isBlank()) {
                Path staticPath = Paths.get("src", "main", "resources", "static", "streamers.json");
                if (!Files.exists(staticPath)) {
                    staticPath = Paths.get("docs", "streamers.json");
                }
                if (Files.exists(staticPath)) {
                    content = Files.readString(staticPath, StandardCharsets.UTF_8);
                    log.info("정적 streamers.json 파일로부터 초기 DB 시딩을 시도합니다.");
                }
            }

            if (content != null) {
                if (content.startsWith("\uFEFF")) {
                    content = content.substring(1);
                }
                com.fasterxml.jackson.databind.JsonNode root = objectMapper.readTree(content);
                com.fasterxml.jackson.databind.JsonNode categories = root.has("categories") ? root.get("categories") : root;
                if (categories != null && categories.isArray()) {
                    Map<String, StreamerDto> dtoMap = new LinkedHashMap<>();
                    for (com.fasterxml.jackson.databind.JsonNode cat : categories) {
                        String catId = cat.has("id") ? cat.get("id").asText() : "";
                        boolean hasSubgroups = cat.has("hasSubgroups") && cat.get("hasSubgroups").asBoolean();
                        if (hasSubgroups && cat.has("groups") && cat.get("groups").isArray()) {
                            for (com.fasterxml.jackson.databind.JsonNode g : cat.get("groups")) {
                                String gId = g.has("id") ? g.get("id").asText() : "";
                                if (g.has("members") && g.get("members").isArray()) {
                                    for (com.fasterxml.jackson.databind.JsonNode m : g.get("members")) {
                                        StreamerDto dto = parseMemberJsonToDto(m, catId, gId);
                                        if (dto != null && dto.getId() != null && !dtoMap.containsKey(dto.getId())) {
                                            dtoMap.put(dto.getId(), dto);
                                        }
                                    }
                                }
                            }
                        } else if (cat.has("members") && cat.get("members").isArray()) {
                            for (com.fasterxml.jackson.databind.JsonNode m : cat.get("members")) {
                                StreamerDto dto = parseMemberJsonToDto(m, catId, null);
                                if (dto != null && dto.getId() != null && !dtoMap.containsKey(dto.getId())) {
                                    dtoMap.put(dto.getId(), dto);
                                }
                            }
                        }
                    }
                    if (!dtoMap.isEmpty()) {
                        log.info("빈 DB에 초기 스트리머 {}명 시딩을 시작합니다.", dtoMap.size());
                        syncStreamers(new ArrayList<>(dtoMap.values()));
                        log.info("DB 초기 스트리머 시딩 완료: 총 {}명", streamerRepository.count());
                    }
                }
            }
        } catch (Exception e) {
            log.error("DB 스트리머 초기 동기화 실패: {}", e.getMessage(), e);
        }
    }

    private StreamerDto parseMemberJsonToDto(com.fasterxml.jackson.databind.JsonNode m, String catId, String subgroupId) {
        if (m == null) return null;
        String id = m.has("id") ? m.get("id").asText() : null;
        String name = m.has("name") ? m.get("name").asText() : "";
        String streamer = m.has("streamer") ? m.get("streamer").asText() : "";
        String role = m.has("role") ? m.get("role").asText() : "";
        String swatRole = m.has("swatRole") ? m.get("swatRole").asText() : "";
        String badgeColor = m.has("badgeColor") ? m.get("badgeColor").asText() : "";
        String status = m.has("status") ? m.get("status").asText() : "active";
        String avatar = m.has("avatar") ? m.get("avatar").asText() : "assets/default-avatar.svg";
        int displayOrder = m.has("displayOrder") ? m.get("displayOrder").asInt() : 0;
        String subscriberCount = m.has("subscriberCount") ? m.get("subscriberCount").asText() : "";
        String youtubeUrl = m.has("youtubeUrl") ? m.get("youtubeUrl").asText() : "";
        String category = m.has("category") ? m.get("category").asText() : catId;
        String subgroup = m.has("subgroup") && !m.get("subgroup").isNull() ? m.get("subgroup").asText() : subgroupId;
        String affiliations = null;
        if (m.has("affiliations") && !m.get("affiliations").isNull()) {
            try {
                affiliations = objectMapper.writeValueAsString(m.get("affiliations"));
            } catch (Exception ignored) {}
        }

        List<VideoDto> videos = new ArrayList<>();
        if (m.has("videos") && m.get("videos").isArray()) {
            for (com.fasterxml.jackson.databind.JsonNode v : m.get("videos")) {
                VideoDto vDto = VideoDto.builder()
                        .id(v.has("id") ? v.get("id").asText() : null)
                        .title(v.has("title") ? v.get("title").asText() : "")
                        .url(v.has("url") ? v.get("url").asText() : "")
                        .videoType(v.has("videoType") ? v.get("videoType").asText() : "clip")
                        .date(v.has("date") ? v.get("date").asText() : "")
                        .duration(v.has("duration") ? v.get("duration").asText() : "")
                        .description(v.has("description") ? v.get("description").asText() : "")
                        .thumbnailUrl(v.has("thumbnailUrl") ? v.get("thumbnailUrl").asText() : "")
                        .displayOrder(v.has("displayOrder") ? v.get("displayOrder").asInt() : 0)
                        .viewCount(v.has("viewCount") && !v.get("viewCount").isNull() ? v.get("viewCount").asLong() : null)
                        .build();
                videos.add(vDto);
            }
        }

        return StreamerDto.builder()
                .id(id)
                .name(name)
                .streamer(streamer)
                .category(category)
                .subgroup(subgroup)
                .role(role)
                .swatRole(swatRole)
                .badgeColor(badgeColor)
                .status(status)
                .avatar(avatar)
                .displayOrder(displayOrder)
                .subscriberCount(subscriberCount)
                .youtubeUrl(youtubeUrl)
                .affiliations(affiliations)
                .videos(videos)
                .build();
    }

    public long countStreamers() {
        return streamerRepository.count();
    }

    private Optional<Streamer> findStreamerEntity(String idOrCustomId) {
        if (idOrCustomId == null || idOrCustomId.isBlank()) return Optional.empty();
        Optional<Streamer> opt = streamerRepository.findByCustomId(idOrCustomId);
        if (opt.isPresent()) return opt;
        try {
            Long numId = Long.parseLong(idOrCustomId);
            return streamerRepository.findById(numId);
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }

    private Optional<Video> findVideoEntity(String idOrCustomId) {
        if (idOrCustomId == null || idOrCustomId.isBlank()) return Optional.empty();
        Optional<Video> opt = videoRepository.findByCustomId(idOrCustomId);
        if (opt.isPresent()) return opt;
        try {
            Long numId = Long.parseLong(idOrCustomId);
            return videoRepository.findById(numId);
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }
}
