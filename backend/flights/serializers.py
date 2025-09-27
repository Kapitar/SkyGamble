from rest_framework import serializers

class UploadPDFSerializer(serializers.Serializer):
    file = serializers.FileField()