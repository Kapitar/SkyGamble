from django.urls import path
from .views import UploadItineraryView, PredictFlightView

urlpatterns = [
    path('upload', UploadItineraryView.as_view(), name='upload-itinerary'),
    path('predict', PredictFlightView.as_view(), name='predict-flight'),
]
