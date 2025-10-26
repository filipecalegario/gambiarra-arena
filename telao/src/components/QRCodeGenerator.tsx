import { QRCodeSVG } from 'qrcode.react';

interface QRCodeGeneratorProps {
  value: string;
  size?: number;
}

function QRCodeGenerator({ value, size = 256 }: QRCodeGeneratorProps) {
  return (
    <div className="inline-block p-4 bg-white rounded-lg">
      <QRCodeSVG value={value} size={size} level="H" />
    </div>
  );
}

export default QRCodeGenerator;
