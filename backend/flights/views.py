import os
import json
import mimetypes
from openai import OpenAI
from rest_framework.parsers import MultiPartParser
from rest_framework.views import APIView, Response
from .serializers import UploadPDFSerializer
from .utils import PARSER_PROMPT

client = OpenAI(
    api_key=os.environ.get("OPENAI_API_KEY"),
)


class UploadItinerary(APIView):
    parser_classes = [MultiPartParser]

    def post(self, request):
        serializer = UploadPDFSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        up = serializer.validated_data["file"]

        filename = getattr(up, "name", "upload.bin")
        content_type = (
            getattr(up, "content_type", None)
            or mimetypes.guess_type(filename)[0]
            or "application/octet-stream"
        )

        if hasattr(up, "temporary_file_path"):  
            with open(up.temporary_file_path(), "rb") as fh:
                data = fh.read()
        else:
            up.seek(0)
            data = up.read()
            
        parts = [{"type": "input_text", "text": PARSER_PROMPT}]


        result = client.files.create(
            file=(filename, data, content_type), 
            purpose="user_data",
        )
        if content_type == "application/pdf":
            parts.append({"type": "input_file", "file_id": result.id})
        elif content_type.startswith("image/"):
            parts.append({"type": "input_image", "file_id": result.id})   
            
        response = client.responses.create(
            model="gpt-5-nano",
            input=[
                {
                    "role": "user",
                    "content": parts
                }
            ],
        )
        
        response = response.output_text.strip().replace("\n", "")
        response_json = json.loads(response)

        return Response(response_json, status=201)
