from django.urls import path
from .views import UploadItineraryView

urlpatterns = [
    path('upload', UploadItineraryView.as_view(), name='upload-itinerary'),
]
