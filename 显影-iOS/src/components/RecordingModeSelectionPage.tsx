import { motion } from 'motion/react';
import { ChevronLeft, Hand, Radio, CircleDot, Mic, Video, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from './ui/button';

interface RecordingModeSelectionPageProps {
  onNavigate: (page: string, data?: any) => void;
  onBack: () => void;
}

type DeviceStatus = 'checking' | 'success' | 'error';

interface DeviceCheckResult {
  audio: DeviceStatus;
  video: DeviceStatus;
  audioDevice?: string;
  videoDevice?: string;
  error?: string;
  errorType?: 'permission' | 'not-found' | 'other';
}

export function RecordingModeSelectionPage({ onNavigate, onBack }: RecordingModeSelectionPageProps) {
  const [selectedMode, setSelectedMode] = useState<'manual' | 'nfc' | null>(null);
  const [deviceCheck, setDeviceCheck] = useState<DeviceCheckResult>({
    audio: 'checking',
    video: 'checking',
  });
  const [isCheckingDevices, setIsCheckingDevices] = useState(false);
  const [hasStartedCheck, setHasStartedCheck] = useState(false);

  // 不自动检测，等待用户主动触发
  // useEffect(() => {
  //   checkDevices();
  // }, []);

  const checkDevices = async () => {
    setIsCheckingDevices(true);
    setHasStartedCheck(true);
    
    try {
      // 检测音频设备
      const audioCheck = await checkAudioDevice();
      setDeviceCheck(prev => ({
        ...prev,
        audio: audioCheck.status,
        audioDevice: audioCheck.device,
        errorType: audioCheck.errorType,
      }));

      // 延迟一点，让UI看起来更自然
      await new Promise(resolve => setTimeout(resolve, 500));

      // 检测视频设备
      const videoCheck = await checkVideoDevice();
      setDeviceCheck(prev => ({
        ...prev,
        video: videoCheck.status,
        videoDevice: videoCheck.device,
        errorType: videoCheck.errorType || prev.errorType,
      }));

    } catch (error) {
      console.error('设备检测失败:', error);
      setDeviceCheck(prev => ({
        ...prev,
        audio: 'error',
        video: 'error',
        error: '设备检测失败，请刷新页面重试',
        errorType: 'other',
      }));
    } finally {
      setIsCheckingDevices(false);
    }
  };

  const checkAudioDevice = async (): Promise<{ status: DeviceStatus; device?: string; errorType?: 'permission' | 'not-found' | 'other' }> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioTracks = stream.getAudioTracks();
      
      if (audioTracks.length > 0) {
        const deviceName = audioTracks[0].label || '默认麦克风';
        // 停止音频流
        stream.getTracks().forEach(track => track.stop());
        return { status: 'success', device: deviceName };
      }
      
      return { status: 'error', errorType: 'not-found' };
    } catch (error: any) {
      console.error('音频设备检测失败:', error);
      
      // 判断错误类型
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        return { status: 'error', errorType: 'permission' };
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        return { status: 'error', errorType: 'not-found' };
      }
      
      return { status: 'error', errorType: 'other' };
    }
  };

  const checkVideoDevice = async (): Promise<{ status: DeviceStatus; device?: string; errorType?: 'permission' | 'not-found' | 'other' }> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const videoTracks = stream.getVideoTracks();
      
      if (videoTracks.length > 0) {
        const deviceName = videoTracks[0].label || '默认摄像头';
        // 停止视频流
        stream.getTracks().forEach(track => track.stop());
        return { status: 'success', device: deviceName };
      }
      
      return { status: 'error', errorType: 'not-found' };
    } catch (error: any) {
      console.error('视频设备检测失败:', error);
      
      // 判断错误类型
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        return { status: 'error', errorType: 'permission' };
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        return { status: 'error', errorType: 'not-found' };
      }
      
      return { status: 'error', errorType: 'other' };
    }
  };

  const handleNext = () => {
    if (!selectedMode) return;
    
    // 直接进入录制页面，传递启动模式
    onNavigate('recording', {
      mode: selectedMode,
    });
  };

  const isDeviceCheckComplete = deviceCheck.audio !== 'checking' && deviceCheck.video !== 'checking';
  const isDeviceCheckSuccess = deviceCheck.audio === 'success' && deviceCheck.video === 'success';
  const canSelectMode = isDeviceCheckComplete && isDeviceCheckSuccess;

  const getStatusIcon = (status: DeviceStatus) => {
    switch (status) {
      case 'checking':
        return <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />;
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
    }
  };

  return (
    <div className="bg-background text-foreground flex flex-col overflow-hidden" style={{ height: '100dvh' }}>
      {/* Header */}
      <div className="flex-shrink-0 z-10 bg-background/95 backdrop-blur-lg border-b border-border safe-top">
        <div className="flex items-center justify-between px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="w-11 h-11"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <h2 className="font-serif">选择启动模式</h2>
          <div className="w-9" />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 pb-20 space-y-8 max-w-2xl mx-auto w-full">
        {/* Initial State - Before checking */}
        {!hasStartedCheck && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-2"
            >
              <div className="flex items-center gap-2">
                <div className="w-1 h-6 bg-foreground rounded-full" />
                <h3>设备权限请求</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                为了正常录制，我们需要访问您的麦克风和摄像头。请点击下方按钮授予权限。
              </p>
            </motion.div>

            {/* Permission Info Cards */}
            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="w-full p-5 rounded-2xl border border-border bg-card"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                    <Mic className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <h4 className="mb-1">麦克风权限</h4>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      用于录制音频和识别对话内容
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="w-full p-5 rounded-2xl border border-border bg-card"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                    <Video className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <h4 className="mb-1">摄像头权限</h4>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      用于录制视频和捕捉交互场景
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Privacy Note */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="p-4 rounded-lg bg-muted/50 border border-border"
            >
              <p className="text-xs text-muted-foreground leading-relaxed text-center">
                🔒 您的隐私很重要。所有录制内容仅保存在本地设备，不会上传到任何服务器。
              </p>
            </motion.div>

            {/* Start Check Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Button
                onClick={checkDevices}
                className="w-full h-12"
                size="lg"
              >
                开始检测设备
              </Button>
            </motion.div>
          </>
        )}

        {/* Checking & Results State - After checking started */}
        {hasStartedCheck && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-2"
            >
              <div className="flex items-center gap-2">
                <div className="w-1 h-6 bg-foreground rounded-full" />
                <h3>设备检测</h3>
              </div>
              <p className="text-muted-foreground">
                {isCheckingDevices ? '正在检测音频和视频设备，请稍候...' : '设备检测完成'}
              </p>
            </motion.div>

            {/* Device Check Cards */}
            <div className="space-y-4">
              {/* Audio Device Check */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className={`w-full p-5 rounded-2xl border transition-all ${
                  deviceCheck.audio === 'success'
                    ? 'border-green-600/30 bg-green-50/50 dark:bg-green-950/20'
                    : deviceCheck.audio === 'error'
                    ? 'border-red-600/30 bg-red-50/50 dark:bg-red-950/20'
                    : 'border-border bg-card'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${
                    deviceCheck.audio === 'success'
                      ? 'bg-green-100 dark:bg-green-900/30'
                      : deviceCheck.audio === 'error'
                      ? 'bg-red-100 dark:bg-red-900/30'
                      : 'bg-muted'
                  }`}>
                    <Mic className={`w-6 h-6 ${
                      deviceCheck.audio === 'success'
                        ? 'text-green-600'
                        : deviceCheck.audio === 'error'
                        ? 'text-red-600'
                        : 'text-muted-foreground'
                    }`} />
                  </div>

                  <div className="flex-1">
                    <h4 className="mb-1">音频设备</h4>
                    <p className="text-muted-foreground text-sm">
                      {deviceCheck.audioDevice || '检测麦克风...'}
                    </p>
                  </div>

                  <div className="flex-shrink-0">
                    {getStatusIcon(deviceCheck.audio)}
                  </div>
                </div>
              </motion.div>

              {/* Video Device Check */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className={`w-full p-5 rounded-2xl border transition-all ${
                  deviceCheck.video === 'success'
                    ? 'border-green-600/30 bg-green-50/50 dark:bg-green-950/20'
                    : deviceCheck.video === 'error'
                    ? 'border-red-600/30 bg-red-50/50 dark:bg-red-950/20'
                    : 'border-border bg-card'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${
                    deviceCheck.video === 'success'
                      ? 'bg-green-100 dark:bg-green-900/30'
                      : deviceCheck.video === 'error'
                      ? 'bg-red-100 dark:bg-red-900/30'
                      : 'bg-muted'
                  }`}>
                    <Video className={`w-6 h-6 ${
                      deviceCheck.video === 'success'
                        ? 'text-green-600'
                        : deviceCheck.video === 'error'
                        ? 'text-red-600'
                        : 'text-muted-foreground'
                    }`} />
                  </div>

                  <div className="flex-1">
                    <h4 className="mb-1">视频设备</h4>
                    <p className="text-muted-foreground text-sm">
                      {deviceCheck.videoDevice || '检测摄像头...'}
                    </p>
                  </div>

                  <div className="flex-shrink-0">
                    {getStatusIcon(deviceCheck.video)}
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Error Message */}
            {!isDeviceCheckSuccess && isDeviceCheckComplete && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* Permission Error - Special handling */}
                {deviceCheck.errorType === 'permission' && (
                  <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                        <XCircle className="w-5 h-5 text-amber-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-amber-900 dark:text-amber-100 mb-2">需要设备访问权限</h4>
                        <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
                          应用需要访问您的麦克风和摄像头才能正常工作。请点击下方按钮重新请求权限，或在浏览器地址栏中手动允许权限。
                        </p>
                      </div>
                    </div>

                    {/* Permission instruction steps */}
                    <div className="bg-white/50 dark:bg-black/20 rounded-lg p-4 mb-4 space-y-2">
                      <p className="text-xs font-medium text-amber-900 dark:text-amber-100 mb-2">权限设置步骤：</p>
                      <ol className="text-xs text-amber-800 dark:text-amber-200 space-y-1.5 list-decimal list-inside leading-relaxed">
                        <li>点击浏览器地址栏左侧的🔒或ℹ️图标</li>
                        <li>找到"麦克风"和"摄像头"权限设置</li>
                        <li>将权限设置为"允许"</li>
                        <li>刷新页面重新检测</li>
                      </ol>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        onClick={checkDevices}
                        className="flex-1"
                        size="sm"
                      >
                        重新请求权限
                      </Button>
                      <Button
                        onClick={() => window.location.reload()}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        刷新页面
                      </Button>
                    </div>
                  </div>
                )}

                {/* Device Not Found Error */}
                {deviceCheck.errorType === 'not-found' && (
                  <div className="p-5 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                        <XCircle className="w-5 h-5 text-red-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-red-900 dark:text-red-100 mb-2">未找到设备</h4>
                        <p className="text-sm text-red-800 dark:text-red-200 leading-relaxed">
                          未检测到麦克风或摄像头设备。请确保设备已正确连接并被系统识别，然后重新检测。
                        </p>
                      </div>
                    </div>

                    <Button
                      onClick={checkDevices}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      重新检测
                    </Button>
                  </div>
                )}

                {/* Other Errors */}
                {deviceCheck.errorType === 'other' && (
                  <div className="p-5 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                        <XCircle className="w-5 h-5 text-red-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-red-900 dark:text-red-100 mb-2">设备检测失败</h4>
                        <p className="text-sm text-red-800 dark:text-red-200 leading-relaxed">
                          设备检测过程中发生错误。请刷新页面重试，或检查浏览器是否支持媒体设备访问。
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        onClick={checkDevices}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        重新检测
                      </Button>
                      <Button
                        onClick={() => window.location.reload()}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        刷新页面
                      </Button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Success Message & Mode Selection */}
            {isDeviceCheckSuccess && (
              <>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900"
                >
                  <p className="text-sm text-green-900 dark:text-green-100 leading-relaxed flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    设备检测通过！请选择启动模式继续。
                  </p>
                </motion.div>

                <div className="space-y-2 pt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-6 bg-foreground rounded-full" />
                    <h3>选择启动模式</h3>
                  </div>
                  <p className="text-muted-foreground">
                    系统将自动识别对话和发言人
                  </p>
                </div>

                {/* Mode Cards */}
                <div className="space-y-4">
                  {/* Manual Mode */}
                  <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    onClick={() => setSelectedMode('manual')}
                    className={`w-full p-6 rounded-2xl border transition-all text-left ${
                      selectedMode === 'manual'
                        ? 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20'
                        : 'border-border bg-card active:border-primary/50'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${
                        selectedMode === 'manual' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-muted'
                      }`}>
                        <Hand className={`w-6 h-6 ${selectedMode === 'manual' ? 'text-blue-600' : 'text-muted-foreground'}`} />
                      </div>
                      
                      <div className="flex-1">
                        <h4 className="mb-2">手动启动</h4>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                          手动启动录制，系统自动识别发言人，会后可编辑姓名。
                        </p>
                        
                        <div className="mt-4 flex flex-wrap gap-2">
                          <span className={`px-2 py-1 rounded-md text-xs border transition-colors ${
                            selectedMode === 'manual'
                              ? 'bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300'
                              : 'bg-background border-border'
                          }`}>
                            简单直观
                          </span>
                          <span className={`px-2 py-1 rounded-md text-xs border transition-colors ${
                            selectedMode === 'manual'
                              ? 'bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300'
                              : 'bg-background border-border'
                          }`}>
                            适合小型会议
                          </span>
                        </div>
                      </div>

                      {selectedMode === 'manual' && (
                        <div className="flex-shrink-0">
                          <CheckCircle2 className="w-5 h-5 text-blue-600" />
                        </div>
                      )}
                    </div>
                  </motion.button>

                  {/* NFC Mode */}
                  <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    onClick={() => setSelectedMode('nfc')}
                    className={`w-full p-6 rounded-2xl border transition-all text-left ${
                      selectedMode === 'nfc'
                        ? 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20'
                        : 'border-border bg-card active:border-primary/50'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${
                        selectedMode === 'nfc' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-muted'
                      }`}>
                        <Radio className={`w-6 h-6 ${selectedMode === 'nfc' ? 'text-blue-600' : 'text-muted-foreground'}`} />
                      </div>
                      
                      <div className="flex-1">
                        <h4 className="mb-2">NFC 触发</h4>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                          通过 NFC 标签自动识别参与者身份并记录发言人，适合多人场景。
                        </p>
                        
                        <div className="mt-4 flex flex-wrap gap-2">
                          <span className={`px-2 py-1 rounded-md text-xs border transition-colors ${
                            selectedMode === 'nfc'
                              ? 'bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300'
                              : 'bg-background border-border'
                          }`}>
                            自动识别
                          </span>
                          <span className={`px-2 py-1 rounded-md text-xs border transition-colors ${
                            selectedMode === 'nfc'
                              ? 'bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300'
                              : 'bg-background border-border'
                          }`}>
                            适合多人场景
                          </span>
                          <span className={`px-2 py-1 rounded-md text-xs border transition-colors ${
                            selectedMode === 'nfc'
                              ? 'bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300'
                              : 'bg-background border-border'
                          }`}>
                            需要 NFC 设备
                          </span>
                        </div>
                      </div>

                      {selectedMode === 'nfc' && (
                        <div className="flex-shrink-0">
                          <CheckCircle2 className="w-5 h-5 text-blue-600" />
                        </div>
                      )}
                    </div>
                  </motion.button>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Bottom Action */}
      <div className="fixed bottom-0 left-0 right-0 px-4 py-2 bg-background/95 backdrop-blur-lg border-t border-border safe-bottom" style={{ minHeight: '68px' }}>
        <div className="max-w-2xl mx-auto">
          <Button
            onClick={handleNext}
            disabled={!selectedMode || !canSelectMode}
            className="w-full h-10"
          >
            下一步
          </Button>
        </div>
      </div>
    </div>
  );
}