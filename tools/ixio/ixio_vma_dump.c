/* IXIO process-wide VMA capture: no DEX filtering, no AppSealing assumptions.
 * Output stream: "IXIOMEM1" then:
 * M: start(u64),end(u64),offset(u64),perms(4),pathlen(u16),path
 * D: address(u64),len(u32),raw bytes
 * X: address(u64),len(u32),errno(u32)
 * Z: end marker. All integer fields little endian.
 */
#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <inttypes.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/uio.h>
#include <sys/types.h>
#include <unistd.h>

static void raw(const void *p,size_t n) { if (fwrite(p,1,n,stdout)!=n) exit(21); }
static void u8(uint8_t x) { raw(&x,1); }
static void u16(uint16_t x) { unsigned char b[2]={(unsigned char)x,(unsigned char)(x>>8)};raw(b,2); }
static void u32(uint32_t x) { unsigned char b[4];for(int i=0;i<4;i++)b[i]=(unsigned char)(x>>(8*i));raw(b,4); }
static void u64(uint64_t x) { unsigned char b[8];for(int i=0;i<8;i++)b[i]=(unsigned char)(x>>(8*i));raw(b,8); }
static void data(uint64_t a,const void *buf,uint32_t n){u8('D');u64(a);u32(n);raw(buf,n);}
static void err(uint64_t a,uint32_t n,int e){u8('X');u64(a);u32(n);u32((uint32_t)e);}
static ssize_t read_one(int fd,pid_t pid,uint64_t addr,void *buf,size_t n,int *error) {
  ssize_t out=pread(fd,buf,n,(off_t)addr);
  if(out>0)return out;
  int saved=errno;
  struct iovec local={.iov_base=buf,.iov_len=n},remote={.iov_base=(void *)(uintptr_t)addr,.iov_len=n};
  out=process_vm_readv(pid,&local,1,&remote,1,0);
  if(out>0)return out;
  *error=errno?errno:saved;
  return -1;
}
static void capture(int fd,pid_t pid,uint64_t address,uint64_t n,unsigned char *buf) {
  const uint32_t chunk=65536;
  while(n) {
    uint32_t wanted=n>chunk?chunk:(uint32_t)n;
    int e=0;ssize_t got=read_one(fd,pid,address,buf,wanted,&e);
    if(got==(ssize_t)wanted) {data(address,buf,wanted);address+=wanted;n-=wanted;continue;}
    if(got>0) {data(address,buf,(uint32_t)got);address+=(uint32_t)got;n-=(uint32_t)got;continue;}
    /* retry page-by-page, preserving every inaccessible byte range in X records */
    uint32_t fallback=wanted>4096?4096:wanted;
    got=read_one(fd,pid,address,buf,fallback,&e);
    if(got>0) {data(address,buf,(uint32_t)got);address+=(uint32_t)got;n-=(uint32_t)got;}
    else {err(address,fallback,e);address+=fallback;n-=fallback;}
  }
}
int main(int argc,char **argv) {
 if(argc!=2){fprintf(stderr,"usage: ixio_vma_dump PID\n");return 2;}
 char *endptr=0;long p=strtol(argv[1],&endptr,10);
 if(p<=1||*endptr){fprintf(stderr,"invalid PID\n");return 2;}
 char maps[128],mem[128];snprintf(maps,sizeof(maps),"/proc/%ld/maps",p);snprintf(mem,sizeof(mem),"/proc/%ld/mem",p);
 FILE *f=fopen(maps,"r");if(!f){perror("open maps");return 4;}
 int fd=open(mem,O_RDONLY|O_CLOEXEC);
 if(fd<0){perror("open mem (will attempt process_vm_readv)");}
 raw("IXIOMEM1",8);
 char *line=0;size_t cap=0;unsigned char *buf=malloc(65536);
 if(!buf){fprintf(stderr,"out of memory\n");return 5;}
 while(getline(&line,&cap,f)>0) {
    unsigned long long a=0,b=0,off=0;
    char perms[5]={0},dev[64]={0},inode[64]={0};int consumed=0;
    int fields=sscanf(line,"%llx-%llx %4s %llx %63s %63s %n",&a,&b,perms,&off,dev,inode,&consumed);
    if(fields<6||b<a) {fprintf(stderr,"UNPARSED_MAP: %s",line);continue;}
    char *path=line+consumed;
    while(*path==' '||*path=='\t')path++;
    size_t plen=strcspn(path,"\r\n");if(plen>65535)plen=65535;
    u8('M');u64((uint64_t)a);u64((uint64_t)b);u64((uint64_t)off);
    char perm4[4]={'-','-','-','-'};memcpy(perm4,perms,strlen(perms)>4?4:strlen(perms));
    raw(perm4,4);u16((uint16_t)plen);raw(path,plen);
    if(perms[0]=='r' && b>a)capture(fd,(pid_t)p,(uint64_t)a,(uint64_t)(b-a),buf);
 }
 u8('Z');fflush(stdout);free(buf);free(line);fclose(f);if(fd>=0)close(fd);return ferror(stdout)?6:0;
}
