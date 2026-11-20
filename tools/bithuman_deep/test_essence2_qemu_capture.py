import struct
import unittest
from capture_qemu_wav_stream import extract

class QemuCaptureTest(unittest.TestCase):
    def test_device_reopen_preserves_both_original_pcm_buffers(self):
        first=struct.pack('<8h',1,2,3,4,5,6,7,8)
        second=struct.pack('<4h',101,102,103,104)
        header=b'RIFF'+bytes(4)+b'WAVEfmt '+struct.pack('<IHHIIHH',16,1,2,48000,192000,4,16)+b'data'+bytes(4)
        pcm,rate,channels,opens=extract(header+first+header+second)
        self.assertEqual(pcm,first+second)
        self.assertEqual((rate,channels,opens),(48000,2,2))
    def test_missing_and_truncated_output_are_rejected(self):
        with self.assertRaises(AssertionError): extract(b'')
        header=b'RIFF'+bytes(4)+b'WAVEfmt '+struct.pack('<IHHIIHH',16,1,2,48000,192000,4,16)+b'data'+bytes(4)
        with self.assertRaises(AssertionError): extract(header+b'123')

    @unittest.skipUnless(hasattr(__import__('os'),'mkfifo'),'Requires a POSIX FIFO')
    def test_real_fifo_survives_writer_close_and_reopen(self):
        import os
        from pathlib import Path
        import subprocess
        import sys
        import tempfile
        import time
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp);raw=path/'capture.raw';pipe=path/'capture.fifo'
            proc=subprocess.Popen([sys.executable,str(Path(__file__).with_name('capture_qemu_wav_stream.py')),
                                   'collect','--pipe',str(pipe),'--raw',str(raw)])
            try:
                for _ in range(50):
                    if raw.with_suffix('.ready').exists(): break
                    time.sleep(.05)
                self.assertTrue(raw.with_suffix('.ready').exists())
                header=b'RIFF'+bytes(4)+b'WAVEfmt '+struct.pack('<IHHIIHH',16,1,2,48000,192000,4,16)+b'data'+bytes(4)
                for data in (b'12345678',b'abcdefgh'):
                    with pipe.open('wb') as output: output.write(header+data)
                subprocess.run([sys.executable,str(Path(__file__).with_name('capture_qemu_wav_stream.py')),
                                'finalize','--raw',str(raw),'--wav',str(path/'out.wav')],check=True)
                proc.wait(timeout=5)
                import wave
                with wave.open(str(path/'out.wav')) as audio:
                    self.assertEqual(audio.readframes(99),b'12345678abcdefgh')
                self.assertFalse(pipe.exists())
            finally:
                if proc.poll() is None: proc.terminate();proc.wait(timeout=5)
