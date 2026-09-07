---
name: VM 설치 스크립트 검증 방법
description: Replit 안에서 systemd 기반 설치 스크립트를 실제와 유사하게 검증하는 방법과 함정
---

Replit에서 docker가 동작하며, systemd 컨테이너로 설치 스크립트를 실제 검증할 수 있다:
`docker run -d --tmpfs /run --tmpfs /run/lock --tmpfs /tmp -v /sys/fs/cgroup:/sys/fs/cgroup:rw --cgroupns=private jrei/systemd-ubuntu:22.04`
(`--privileged`/`--cgroupns=host`는 sysfs 마운트 권한 오류로 실패)

**함정:**
- apt의 libc6 업그레이드가 `systemctl daemon-reexec`를 호출해 컨테이너 PID1이 죽는다(exit 255). 해결: systemctl을 임시로 `/bin/true`로 divert한 뒤 `dpkg --configure -a`.
- postgresql@ 유닛은 "New main PID does not belong to service" 로 기동이 영원히 걸린다(컨테이너 한정 문제, 실제 VM은 정상). 해결: drop-in으로 `Type=oneshot` + `RemainAfterExit=yes` + `PIDFile=` + `GuessMainPID=no`.

**install.sh에서 실제로 잡은 버그 (재발 주의):**
- root로 실행 시 `$SUDO`가 빈 문자열이라 `$SUDO -u postgres psql`이 깨짐 → `psql_as_postgres` 헬퍼(runuser/su 폴백) 사용. 새 psql 호출을 추가할 때 반드시 이 헬퍼를 쓸 것.
- Ollama 공식 설치 스크립트는 zstd가 필요 → 기본 패키지 목록에 zstd 포함됨.
- Replit Docker의 컨테이너 헬스체크 `exec`가 `setns` 오류로 실패해도 서비스 자체는 정상일 수 있다. 컨테이너 로그와 같은 네트워크의 수동 HTTP/DB 검증으로 구분한다.
- Docker 브리지 DNS만 `EAI_AGAIN`이면 호스트 DNS를 먼저 확인하고, 검증용 빌드에는 `docker build --network=host`를 사용할 수 있다. 운영 Compose 설정에는 이 우회를 넣지 않는다.
